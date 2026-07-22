import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

print("🔄 Loading V2 Model...")
model_path = "./trained_model"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForSequenceClassification.from_pretrained(model_path)

# Use Mac GPU if available
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
model.to(device)
model.eval()

# Let's test it on a crazy fake headline and a boring real one
test_headlines = [
    "WASHINGTON (Reuters) - The Federal Reserve announced a 0.25% interest rate hike in today's meeting."
]

print("\n🚀 Testing AI Brain...")
for headline in test_headlines:
    inputs = tokenizer(headline, return_tensors="pt", truncation=True, max_length=256).to(device)
    with torch.no_grad():
        outputs = model(**inputs)
        prediction = torch.argmax(outputs.logits, dim=-1).item()
        
   # Get the actual percentage confidence
        import torch.nn.functional as F
        probs = F.softmax(outputs.logits, dim=-1)
        confidence = torch.max(probs).item() * 100
        
    label = "REAL" if prediction == 1 else "FAKE"
    print(f"\nHeadline: {headline}")
    print(f"Result:   {label} (Confidence: {confidence:.2f}%)")