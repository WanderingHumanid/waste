'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, Camera, Square, AlertCircle, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'


interface DetectionResult {
  category: 'Wet' | 'Dry' | 'Hazardous' | 'Unknown'
  confidence: number
  details: string
  recommendations: string[]
}

export default function SegregationPage() {
  const [cameraActive, setCameraActive] = useState(false)
  const [useCamera, setUseCamera] = useState(false) // Trigger to start camera
  const [detecting, setDetecting] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Camera Effect
  useEffect(() => {
    let currentStream: MediaStream | null = null

    const initCamera = async () => {
      if (useCamera && !selectedImage) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          })
          currentStream = stream
          setStream(stream)
          setCameraActive(true)

          if (videoRef.current) {
            videoRef.current.srcObject = stream
            // Play is handled by onLoadedMetadata
          }
        } catch (err) {
          console.error("Camera error:", err)
          setUseCamera(false)
          alert("Could not access camera. Please check permissions.")
        }
      } else {
        // Cleanup if stopped
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          setStream(null)
          setCameraActive(false)
        }
      }
    }

    initCamera()

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [useCamera, selectedImage])

  // Attach stream to video whenever ref or stream changes (and we are active)
  useEffect(() => {
    if (videoRef.current && stream && !selectedImage) {
      videoRef.current.srcObject = stream
    }
  }, [stream, videoRef.current, selectedImage])


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSelectedImage(reader.result as string)
        setUseCamera(false) // Stop camera
        setResult(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearImage = () => {
    setSelectedImage(null)
    setResult(null)
    setUseCamera(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      if (context && videoRef.current.videoWidth) {
        canvasRef.current.width = videoRef.current.videoWidth
        canvasRef.current.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0)
        const dataUrl = canvasRef.current.toDataURL('image/jpeg')
        setSelectedImage(dataUrl)
        setUseCamera(false) // Stop camera stream after capture
      }
    }
  }

  const analyzeImage = async () => {
    if (!selectedImage) return
    const imageBase64 = selectedImage.split(',')[1]

    setDetecting(true)
    try {
      const response = await fetch('/api/signals/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("API Error details:", errorData)
        throw new Error(errorData.details || errorData.error || 'Detection failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error("Detection error", error)
      alert("Failed to analyze image. Please try again.")
    } finally {
      setDetecting(false)
    }
  }


  const getResultColor = (category: string) => {
    switch (category) {
      case 'Wet':
        return 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100'
      case 'Dry':
        return 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
      case 'Hazardous':
        return 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100'
      default:
        return 'bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100'
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="w-8 h-8 text-primary" />
          AI Waste Segregation
        </h1>
        <p className="text-muted-foreground mt-2">
          Use your camera to identify and segregate waste types
        </p>
      </div>

      {/* Camera Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Camera Feed
          </CardTitle>
          <CardDescription>
            Position your waste in front of the camera
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700">
            {useCamera && !selectedImage ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => e.currentTarget.play()}
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-4 border-primary rounded-lg pointer-events-none animate-pulse opacity-50" />
              </>
            ) : selectedImage ? (
              <div className="relative w-full h-full">
                <img
                  src={selectedImage}
                  alt="Selected waste"
                  className="w-full h-full object-contain bg-black"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 rounded-full z-10"
                  onClick={clearImage}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center p-6 space-y-4">
                <div className="flex justify-center">
                  <div className="bg-primary/10 p-4 rounded-full">
                    <Camera className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Take a Photo</h3>
                  <p className="text-sm text-muted-foreground">Or upload from your gallery</p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                  <Button onClick={() => setUseCamera(true)} className="gap-2 w-full">
                    <Camera className="w-4 h-4" />
                    Start Camera
                  </Button>
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="image-upload"
                    />
                    <Button variant="outline" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions Area */}
          {useCamera && !selectedImage && (
            <div className="flex gap-2">
              <Button onClick={captureImage} className="flex-1 gap-2" variant="default">
                <Camera className="w-4 h-4" />
                Capture Photo
              </Button>
              <Button onClick={() => setUseCamera(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          )}

          {selectedImage && (
            <div className="flex gap-2">
              <Button
                onClick={analyzeImage}
                disabled={detecting}
                className="flex-1 gap-2"
                size="lg"
              >
                <Square className="w-4 h-4" />
                {detecting ? 'Analyzing...' : 'Analyze Waste'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detection Result */}
      {result && (
        <Card className={cn(
          'border-2',
          result.category === 'Wet' ? 'border-green-300' :
            result.category === 'Dry' ? 'border-blue-300' :
              'border-red-300'
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={cn(
                'w-3 h-3 rounded-full',
                result.category === 'Wet' ? 'bg-green-500' :
                  result.category === 'Dry' ? 'bg-blue-500' :
                    'bg-red-500'
              )} />
              Detection Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'px-4 py-2 rounded-lg font-semibold',
                getResultColor(result.category)
              )}>
                {result.category} Waste
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Confidence</p>
                <p className="text-2xl font-bold">
                  {(result.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Details:</p>
              <p className="text-sm text-muted-foreground">{result.details}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Recommendations:</p>
              <ul className="space-y-1">
                {result.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                    <span>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button className="w-full">Save Result</Button>
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <AlertCircle className="w-5 h-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>1. Click "Start Camera" to activate your device camera</li>
            <li>2. Position your waste in clear view</li>
            <li>3. Click "Capture & Detect" for AI analysis</li>
            <li>4. Review results and follow recommendations</li>
            <li>5. Earn green credits for proper segregation</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
