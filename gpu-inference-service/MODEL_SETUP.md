# Model Setup Guide

## Recommended Models (2025)

### 1. TACO Fine-Tuned (Best Choice) ⭐

**Source:** https://github.com/jeremy-rico/litter-detection

**Why:**
- Best for real-world litter detection
- Actively maintained
- Pre-trained on TACO dataset
- Ready to use

**Setup:**

**Option 1: Use trained weights from repository**
```bash
# Clone repo
git clone https://github.com/jeremy-rico/litter-detection
cd litter-detection

# The trained model weights are in runs/detect/train*/weights/
# Look for best.pt or last.pt
ls runs/detect/train*/weights/

# Copy to GPU service
cp runs/detect/train*/weights/best.pt ../gpu-inference-service/yolov8-taco.pt

# Configure
export MODEL_PATH=yolov8-taco.pt
export MODEL_VERSION=yolov8-taco-v1
```

**Option 2: Train your own model (recommended)**
```bash
# Clone repo
git clone https://github.com/jeremy-rico/litter-detection
cd litter-detection

# Follow their training instructions to fine-tune on TACO dataset
# This will generate a model in runs/detect/train/weights/

# Copy trained model
cp runs/detect/train*/weights/best.pt yolov8-taco.pt

# Configure
export MODEL_PATH=yolov8-taco.pt
export MODEL_VERSION=yolov8-taco-v1
```

**Note:** The repository doesn't provide pre-built release downloads. You need to either:
- Use the weights from their training runs (if available in the repo)
- Train your own model following their instructions
- Start with default YOLOv8 and fine-tune on TACO dataset

### 2. detect-waste (Eco-Focused)

**Source:** 
- Repo: https://github.com/wimlds-trojmiasto/detect-waste
- HuggingFace: https://huggingface.co/datasets/Yorai/detect-waste

**Why:**
- Non-profit oriented
- Perfect for eco-projects like DeCleanup
- Good community support

**Setup:**
```bash
# Download from HuggingFace
# Or clone repo and use their model
git clone https://github.com/wimlds-trojmiasto/detect-waste
# Follow their setup instructions
```

### 3. waste-detection (Simple)

**Source:** https://huggingface.co/sharktide/waste-detection

**Why:**
- Easy to use
- Good performance
- Available on HuggingFace

**Setup:**
```bash
# Download from HuggingFace model files
# Look for best.pt or similar
# Rename to yolov8-waste.pt
```

### 4. TrashNet (Classification)

**Source:** https://github.com/garythung/trashnet

**Why:**
- Stanford dataset
- Good for trash type classification
- Many pre-trained models available

**Setup:**
```bash
git clone https://github.com/garythung/trashnet
# Follow their training/usage instructions
```

## Quick Test (Google Colab - Free)

```python
# Install
!pip install ultralytics

# Test TACO model
from ultralytics import YOLO

# Download model (or use from repo)
model = YOLO('yolov8-taco.pt')  # Or yolov8n.pt for default

# Test on image
results = model.predict('your_cleanup_photo.jpg', conf=0.25)

# See results
for result in results:
    print(f"Detected {len(result.boxes)} objects")
    for box in result.boxes:
        print(f"  - {model.names[int(box.cls)]}: {box.conf:.2f}")
```

## Fine-Tuning on DeCleanup Data (Optional)

If you want to improve accuracy with DeCleanup-specific photos:

1. **Collect Data:**
   - Use existing cleanup submissions
   - Annotate with TACO toolkit: https://github.com/pedropro/TACO

2. **Train:**
   ```python
   from ultralytics import YOLO
   
   model = YOLO('yolov8n.pt')  # Start from base
   
   # Train on TACO + your data
   model.train(
       data='taco_custom.yaml',  # Combined dataset
       epochs=100,
       imgsz=640,
       batch=16
   )
   ```

3. **Validate:**
   - Test on held-out set
   - Compare with baseline
   - Deploy if improved

## Model Comparison

| Model | Accuracy | Speed | Setup | Best For |
|-------|----------|-------|-------|----------|
| TACO fine-tuned | ⭐⭐⭐⭐⭐ | Medium | Medium | Real-world litter |
| detect-waste | ⭐⭐⭐⭐ | Fast | Easy | Eco projects |
| waste-detection | ⭐⭐⭐⭐ | Fast | Easy | General use |
| TrashNet | ⭐⭐⭐ | Very Fast | Easy | Classification |
| Default (yolov8n) | ⭐⭐ | Fast | Very Easy | Testing only |

## Recommendation

**Start with:** TACO fine-tuned (best accuracy)
**Fallback to:** detect-waste (easiest setup)
**For testing:** Default yolov8n (works immediately)

## Resources

- **TACO Dataset:** https://github.com/pedropro/TACO
- **Litter Detection:** https://github.com/jeremy-rico/litter-detection
- **detect-waste:** https://github.com/wimlds-trojmiasto/detect-waste
- **TrashNet:** https://github.com/garythung/trashnet
- **Ultralytics Docs:** https://docs.ultralytics.com
