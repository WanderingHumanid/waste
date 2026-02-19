/**
 * Groq AI Client for Waste Segregation Detection
 * Analyzes images to classify waste as Wet, Dry, or Hazardous
 */

// @ts-ignore
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export interface WasteDetectionResult {
  category: 'Wet' | 'Dry' | 'Hazardous'
  confidence: number
  details: string
  recommendations: string[]
}

/**
 * Detect waste type from image using Groq Vision API
 * @param imageBase64 - Base64 encoded image string
 * @returns Detection result with category and confidence
 */
export async function detectWaste(imageBase64: string): Promise<WasteDetectionResult> {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a waste classification expert. Analyze this image and classify the waste as:
              1. "Wet" (organic waste, food scraps, leaves)
              2. "Dry" (paper, plastic, metal, cloth)
              3. "Hazardous" (batteries, chemicals, glass, syringes)
              
              Respond in JSON format:
              {
                "category": "Wet|Dry|Hazardous",
                "confidence": 0.0-1.0,
                "details": "Brief description of detected items",
                "recommendations": ["recommendation 1", "recommendation 2"]
              }`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      model: 'llama-3.2-90b-vision-preview', // Use a vision-capable model from Groq
      max_tokens: 512,
    })

    const content = response.choices[0]?.message?.content
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid response from Groq API')
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response')
    }

    const result = JSON.parse(jsonMatch[0]) as WasteDetectionResult
    return result
  } catch (error) {
    console.error('Waste detection error:', error)
    throw new Error('Failed to detect waste type')
  }
}

/**
 * Get waste disposal recommendations
 */
export function getWasteRecommendations(category: string): string[] {
  const recommendations: Record<string, string[]> = {
    Wet: [
      'Use green bin for disposal',
      'Can be composted for fertilizer',
      'Will be collected in organic waste stream',
    ],
    Dry: [
      'Separate by material type',
      'Recyclable in circular marketplace',
      'Clean and dry before disposal',
    ],
    Hazardous: [
      'Contact hazmat disposal team',
      'Do not mix with regular waste',
      'Store in designated containers',
      'Schedule special pickup',
    ],
  }

  return recommendations[category] || []
}
