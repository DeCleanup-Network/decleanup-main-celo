/**
 * YOLOv8 Waste Detection
 * Phase 1: Mock implementation (can be replaced with HuggingFace or local model)
 */

import { ImageAnalysis, DetectionResult } from './types'
import { getDMRVConfig } from './config'

/**
 * Mock YOLOv8 detection (for Phase 1)
 * Returns simulated detection results
 * 
 * TODO: Replace with actual YOLOv8 inference:
 * - HuggingFace Inference API
 * - Local YOLOv8 via ultralytics
 * - Docker container with YOLOv8
 */
export async function detectWasteMock(imageBuffer: Buffer, isBefore: boolean): Promise<ImageAnalysis> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Mock detection logic:
  // - BEFORE image should have waste (trash detected)
  // - AFTER image should have no/minimal waste (clean)
  
  if (isBefore) {
    // Before image: simulate waste detection
    const mockDetections: DetectionResult[] = [
      {
        class: 'plastic_bottle',
        confidence: 0.92,
        bbox: [100, 150, 50, 80],
      },
      {
        class: 'plastic_bag',
        confidence: 0.88,
        bbox: [200, 200, 60, 40],
      },
      {
        class: 'paper',
        confidence: 0.75,
        bbox: [300, 100, 40, 50],
      },
    ]
    
    return {
      hasWaste: true,
      wasteCount: mockDetections.length,
      detections: mockDetections,
      overallConfidence: 0.85, // Average confidence
    }
  } else {
    // After image: simulate clean (no waste or minimal)
    return {
      hasWaste: false,
      wasteCount: 0,
      detections: [],
      overallConfidence: 0.90, // High confidence that it's clean
    }
  }
}

/**
 * HuggingFace Inference API detection
 * Supports both object detection and image classification models
 * 
 * Recommended models:
 * - FathomNet/trash-detector (object detection)
 * - prithivMLmods/Trash-Net (image classification)
 * - rootstrap-org/waste-classifier (image classification)
 */
export async function detectWasteHuggingFace(
  imageBuffer: Buffer,
  isBefore: boolean
): Promise<ImageAnalysis> {
  const config = getDMRVConfig()
  const apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
  
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY or HF_TOKEN not configured. Get your token from https://huggingface.co/settings/tokens')
  }
  
  // Default to trash detection model if not specified
  const modelName = config.modelName || 'FathomNet/trash-detector'
  const apiUrl = `https://api-inference.huggingface.co/models/${modelName}`
  
  try {
    // HuggingFace Inference API accepts image as binary or base64
    // Using binary is more efficient
    // Convert Buffer to ArrayBuffer for fetch compatibility
    // Create a new ArrayBuffer to avoid SharedArrayBuffer type issues
    const arrayBuffer = new ArrayBuffer(imageBuffer.length)
    const uint8Array = new Uint8Array(arrayBuffer)
    uint8Array.set(imageBuffer)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'image/jpeg', // or 'image/png' based on image type
      },
      body: arrayBuffer,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      
      // Handle model loading (first request may take time)
      if (response.status === 503) {
        let errorData: { error?: string } = {}
        try {
          errorData = JSON.parse(errorText) as { error?: string }
        } catch (parseError) {
          // If JSON parsing fails, use empty object
          errorData = {}
        }
        
        if (errorData.error?.includes('loading')) {
          // Model is loading, wait and retry
          await new Promise(resolve => setTimeout(resolve, 5000))
          return detectWasteHuggingFace(imageBuffer, isBefore) // Retry once
        }
      }
      
      throw new Error(`HuggingFace API error: ${response.status} ${errorText}`)
    }
    
    const result = await response.json()
    
    // Handle different response formats based on model type
    let detections: DetectionResult[] = []
    
    // Object detection format: [{ label, score, box: { xmin, ymin, xmax, ymax } }]
    if (Array.isArray(result) && result.length > 0 && result[0].box) {
      detections = result.map((item: any) => ({
        class: item.label || item.class || 'trash',
        confidence: item.score || item.confidence || 0,
        bbox: item.box
          ? [item.box.xmin, item.box.ymin, item.box.xmax - item.box.xmin, item.box.ymax - item.box.ymin]
          : undefined,
      }))
    }
    // Image classification format: [{ label, score }]
    else if (Array.isArray(result) && result.length > 0 && result[0].label && result[0].score) {
      // For classification models, treat high-confidence waste classes as detections
      const wasteLabels = [
        'trash', 'waste', 'garbage', 'litter', 'plastic', 'bottle', 'bag',
        'cardboard', 'compost', 'glass', 'metal', 'paper'
      ]
      
      detections = result
        .filter((item: any) => {
          const label = (item.label || '').toLowerCase()
          return wasteLabels.some(wl => label.includes(wl)) && item.score > 0.5
        })
        .map((item: any) => ({
          class: item.label || 'waste',
          confidence: item.score || 0,
          bbox: undefined, // Classification doesn't provide bounding boxes
        }))
    }
    // Single object format: { label, score, box? }
    else if (result.label || result.class) {
      detections = [{
        class: result.label || result.class || 'trash',
        confidence: result.score || result.confidence || 0,
        bbox: result.box
          ? [result.box.xmin, result.box.ymin, result.box.xmax - result.box.xmin, result.box.ymax - result.box.ymin]
          : undefined,
      }]
    }
    
    // Filter for waste-related classes (case-insensitive)
    const wasteKeywords = ['trash', 'waste', 'garbage', 'litter', 'plastic', 'bottle', 'bag', 'paper', 'cardboard', 'compost', 'glass', 'metal']
    const wasteDetections = detections.filter(d => {
      const className = (d.class || '').toLowerCase()
      return wasteKeywords.some(keyword => className.includes(keyword))
    })
    
    // Calculate overall confidence
    const overallConfidence = wasteDetections.length > 0
      ? wasteDetections.reduce((sum, d) => sum + d.confidence, 0) / wasteDetections.length
      : 0.85 // High confidence if no waste detected (clean state)
    
    return {
      hasWaste: wasteDetections.length > 0,
      wasteCount: wasteDetections.length,
      detections: wasteDetections,
      overallConfidence,
    }
  } catch (error) {
    console.error('[DMRV] HuggingFace detection error:', error)
    throw error
  }
}

/**
 * Main detection function - routes to appropriate provider
 */
export async function detectWaste(
  imageBuffer: Buffer,
  isBefore: boolean
): Promise<ImageAnalysis> {
  const config = getDMRVConfig()
  
  switch (config.modelProvider) {
    case 'huggingface':
      return detectWasteHuggingFace(imageBuffer, isBefore)
    case 'local':
      // TODO: Implement local YOLOv8 detection
      throw new Error('Local YOLOv8 detection not yet implemented. Use "mock" or "huggingface" provider.')
    case 'mock':
    default:
      return detectWasteMock(imageBuffer, isBefore)
  }
}
