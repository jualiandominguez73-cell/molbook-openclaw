---
name: tree-doctor
description: Diagnose tree diseases, pests, and health issues from photos. Provides identification, prognosis, treatment options, and prevention tips.
metadata: {"clawdbot":{"gated_by":"stripe-gate"}}
---

# Tree Doctor 🌳

AI-powered tree disease diagnosis from photos.

## How It Works

1. User sends photo of affected tree (leaves, bark, branches, etc.)
2. Agent analyzes image for disease indicators
3. Returns structured diagnosis with treatment recommendations

## Usage (Agent Integration)

Before running diagnosis, check subscription status:

```python
import subprocess

def handle_tree_photo(user_id: str, image_path: str):
    # Check subscription
    result = subprocess.run(
        ["./skills/stripe-gate/scripts/check.py", user_id],
        capture_output=True, text=True
    )
    
    if result.stdout.strip() != "ACTIVE":
        # Get checkout URL
        checkout = subprocess.run(
            ["./skills/stripe-gate/scripts/create-checkout.py", user_id],
            capture_output=True, text=True
        )
        return f"🌳 Tree Amigos Pro required!\n\nGet unlimited tree diagnosis for $5/month:\n{checkout.stdout.strip()}"
    
    # User is subscribed - run diagnosis
    return diagnose_tree(image_path)
```

## Diagnosis Output Format

When analyzing a tree photo, provide:

### 1. Tree Identification
- Species (if identifiable from bark/leaves)
- Confidence level

### 2. Problem Identification
- Primary diagnosis (disease, pest, environmental, etc.)
- Confidence level (high/medium/low)
- Supporting evidence from the image

### 3. Severity Assessment
- Stage (early/moderate/advanced/severe)
- Affected area (localized/spreading/systemic)
- Risk to tree survival

### 4. Treatment Options
- Immediate actions
- Professional treatment recommendations
- DIY remedies (if applicable)
- Timeline for treatment

### 5. Prognosis
- Recovery likelihood
- Expected timeline
- Warning signs to monitor

### 6. Prevention
- How to prevent recurrence
- Care recommendations
- When to call an arborist

## Common Diagnoses

### Fungal Diseases
- **Black Knot** (Prunus spp.) - Black, rough galls on branches
- **Apple Scab** - Olive-brown spots on leaves
- **Anthracnose** - Irregular brown patches, leaf curling
- **Powdery Mildew** - White powdery coating
- **Root Rot** - Wilting, yellowing, mushrooms at base

### Bacterial Diseases
- **Fire Blight** - Blackened, "burned" appearance
- **Bacterial Leaf Scorch** - Marginal leaf browning
- **Crown Gall** - Tumor-like growths at soil line

### Pests
- **Emerald Ash Borer** - D-shaped exit holes, S-shaped galleries
- **Japanese Beetles** - Skeletonized leaves
- **Aphids** - Curled leaves, sticky honeydew
- **Scale Insects** - Bumpy bark, sooty mold
- **Borers** - Sawdust, entry/exit holes

### Environmental
- **Drought Stress** - Wilting, leaf scorch, early drop
- **Frost Damage** - Blackened new growth
- **Sunscald** - Vertical bark cracks on south side
- **Salt Damage** - Marginal browning, stunted growth

## Sample Response

```
🌳 **Tree Diagnosis Report**

**Tree:** Cherry (Prunus species)
**Confidence:** High (based on bark pattern)

---

## 🔬 Diagnosis: BLACK KNOT DISEASE

**Pathogen:** Apiosporina morbosa (fungus)
**Confidence:** Very High

**Evidence:**
- Black, rough, elongated galls on branches
- Tarry, coal-black coloration
- Warty, tumor-like texture

---

## 📊 Severity: MODERATE-ADVANCED

- Stage: 2-3 year old infection
- Affected: Multiple branches
- Spread risk: High (spores active in spring)

---

## 💊 Treatment

**Immediate:**
1. Prune infected branches 6-8" below visible knots
2. Sterilize tools between cuts (10% bleach)
3. Destroy (burn/bag) all removed material - do NOT compost

**Preventive:**
- Apply fungicide (chlorothalonil) in early spring
- Repeat at bud break and petal fall

**Professional:** Consider certified arborist if >30% of canopy affected

---

## 📈 Prognosis

With prompt pruning: Good recovery likely
Without treatment: Disease will spread, may kill tree in 3-5 years

---

## 🛡️ Prevention

- Annual inspection in late winter
- Remove wild cherry/plum within 500ft if possible
- Maintain tree vigor (water, mulch, avoid stress)
```

## Image Analysis Tips

When analyzing tree photos, look for:

1. **Bark:** Cracks, cankers, holes, discoloration, peeling, fungal growth
2. **Leaves:** Spots, holes, curling, wilting, discoloration patterns, premature drop
3. **Branches:** Die-back, galls, oozing sap, sawdust, entry holes
4. **Overall:** Crown thinning, lean, root heaving, mushrooms at base

Request additional photos if needed:
- "Can you send a close-up of the affected bark?"
- "A photo of the leaves would help confirm the diagnosis"
- "Is there any oozing sap or sawdust at the base?"

## Regional Considerations

Ask user location to factor in:
- Regional disease prevalence
- Climate-appropriate treatments
- Local regulations (some diseases require reporting)
- Seasonal timing for treatment
