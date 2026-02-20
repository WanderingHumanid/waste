/**
 * POST /api/signals/detect
 * Detect waste type from image using Groq AI Vision API
 * Requires: image (base64) or imageUrl in request body
 */

import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'dummy_key_for_build',
})

interface DetectionRequest {
  image?: string // Base64 encoded image
  imageUrl?: string
}

interface DetectionResponse {
  category: 'Wet' | 'Dry' | 'Hazardous' | 'Unknown'
  confidence: number
  details: string
  recommendations: string[]
}

// Recommendations for each waste type
const RECOMMENDATIONS: Record<string, string[]> = {
  Wet: [
    'Use green bin for disposal',
    'Can be composted for fertilizer',
    'Will be collected in organic waste stream',
    'Separate from dry and hazardous waste',
  ],
  Dry: [
    'Separate by material type (paper, plastic, metal)',
    'Recyclable in circular marketplace',
    'Clean and dry before disposal',
    'Can be sold or traded for green credits',
  ],
  Hazardous: [
    'Contact hazmat disposal team immediately',
    'Do not mix with regular waste',
    'Store in designated containers',
    'Schedule special pickup',
    'Handle with care and proper equipment',
  ],
}

export async function POST(request: NextRequest) {
  try {
    const body: DetectionRequest = await request.json()

    if (!body.image && !body.imageUrl) {
      return NextResponse.json(
        { error: 'Either image (base64) or imageUrl must be provided' },
        { status: 400 }
      )
    }

    // Prepare image for API call
    const imageUrl = body.imageUrl
      ? body.imageUrl
      : body.image
        ? `data:image/jpeg;base64,${body.image}`
        : undefined

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Invalid image format' },
        { status: 400 }
      )
    }

    // Call Groq API with vision capabilities
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a waste classification expert. Analyze this image and classify the waste as one of these categories:
              
              1. "Wet" (organic waste: food scraps, leaves, flowers, garden waste)
              2. "Dry" (recyclable: paper, plastic, metal, cardboard, cloth, wood)
              3. "Hazardous" (dangerous waste: batteries, chemicals, glass, broken items, syringes, paint cans)
              4. "Unknown" (if you cannot determine the category)
              
              Respond in valid JSON format (no markdown, just the JSON object):
              {
                "category": "Wet|Dry|Hazardous|Unknown",
                "confidence": 0.0 to 1.0 (how confident you are),
                "details": "Brief 1-2 sentence description of detected items",
                "rawAnalysis": "Technical analysis of what you see"
              }`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      model: 'llama-3.2-90b-vision-preview',
      temperature: 0.1,
      max_tokens: 256,
    })

    // Extract and parse response
    const content = response.choices[0]?.message?.content
    if (!content || typeof content !== 'string') {
      console.error('[v0] Invalid response from Groq:', JSON.stringify(response, null, 2))
      return NextResponse.json(
        { error: 'Invalid response from AI service', details: response },
        { status: 500 }
      )
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const parsedResult = JSON.parse(jsonStr)
    const category = (parsedResult.category || 'Unknown') as string

    // Validate category
    if (!['Wet', 'Dry', 'Hazardous', 'Unknown'].includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category received from AI' },
        { status: 500 }
      )
    }

    const detectionResponse: DetectionResponse = {
      category: category as 'Wet' | 'Dry' | 'Hazardous' | 'Unknown',
      confidence: Math.min(Math.max(parseFloat(parsedResult.confidence) || 0, 0), 1),
      details: parsedResult.details || 'Unable to determine waste type',
      recommendations: RECOMMENDATIONS[category] || RECOMMENDATIONS['Unknown'] || [],
    }

    return NextResponse.json(detectionResponse, { status: 200 })
  } catch (error) {
    console.error('[v0] Waste detection error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
