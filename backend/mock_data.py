def generate_ideas(brief: str):
    base = brief.strip() if brief and brief.strip() else "your next campaign"
    return [
        {
            "id": 1,
            "en": f"Highlight how this fits perfectly into daily life around '{base}'.",
            "fr": f"Montrez comment cela s'intègre parfaitement au quotidien autour de « {base} ».",
            "headline_en": "Made for the way you live",
            "headline_fr": "Conçu pour votre quotidien",
            "body_en": "Technology that keeps up with your day, from the first alarm to the last message.",
            "body_fr": "Une technologie qui suit le rythme de vos journées, du premier réveil au dernier message.",
        },
        {
            "id": 2,
            "en": f"Focus strictly on premium design and a limited-time offer for '{base}'.",
            "fr": f"Misez uniquement sur le design premium et une offre à durée limitée pour « {base} ».",
            "headline_en": "Premium design, on your terms",
            "headline_fr": "Un design premium, à vos conditions",
            "body_en": "Crafted materials and a considered finish, available for a limited time.",
            "body_fr": "Des matériaux soignés et une finition réfléchie, offerts pour une durée limitée.",
        }
    ]

def generate_image_assets(product, idea, formats, audiences):
    audienceLabel = (audiences[0] if audiences else "everyone").lower()
    acc = {}
    for size in formats:
        acc[size] = {
            "en": {
                "headline": f"Experience the new {product}.",
                "body": f"Designed for {audienceLabel} who expect the best. {idea['en']}",
            },
            "fr": {
                "headline": f"Découvrez le nouveau {product}.",
                "body": f"Conçu pour {audienceLabel}. {idea['fr']}",
            },
        }
    return acc

def generate_video_assets(product, idea, formats, audiences):
    audienceLabel = (audiences[0] if audiences else "everyone").lower()
    acc = {}
    for format_ in formats:
        acc[format_] = {
            "en": {
                "hook": f"Bold close-up of the {product}.",
                "scenes": [
                  "Scene 1 (0-3s): Fast cut hero shot on a clean set.",
                  f"Scene 2: A {audienceLabel} using the {product} in a real moment.",
                  "Scene 3: On-screen callout of the standout feature.",
                  "Scene 4: End card - logo, product name, CTA.",
                ],
                "cta": f"Learn more about the {product}. {idea.get('en', '')}",
            },
            "fr": {
                "hook": f"Gros plan saisissant sur le {product}.",
                "scenes": [
                  "Scène 1 (0-3s) : plan héros en coupe rapide sur fond neutre.",
                  f"Scène 2 : un(e) {audienceLabel} utilisant le {product} au quotidien.",
                  "Scène 3 : mise en avant à l'écran de la fonctionnalité clé.",
                  "Scène 4 : écran de fin - logo, nom du produit, appel à l'action.",
                ],
                "cta": f"En savoir plus sur le {product}. {idea.get('fr', '')}",
            },
        }
    return acc

def generate_email_assets(product, idea, formats, audiences):
    audienceLabel = (audiences[0] if audiences else "everyone").lower()
    acc = {}
    REENGAGEMENT_PREFS = {
        "en": ["New product launches", "Offers and trade-in deals", "Tips for my devices", "Once a month only"],
        "fr": ["Nouveaux produits", "Offres et reprises", "Conseils pour mes appareils", "Une fois par mois"],
    }
    for type_ in formats:
        reengage = (type_ == "Re-engagement")
        acc[type_] = {
            "en": {
                "subject": "Choose what you hear about" if reengage else f"{product} is here",
                "preheader": "Set your topics and how often we write." if reengage else f"Built with {audienceLabel} in mind.",
                "headline": "Your inbox, your rules" if reengage else f"Meet the {product}",
                "body": "Pick the topics that matter to you and how often you would like to hear from us. You can change this at any time." if reengage else f"{idea['en']}\n\nExplore what the {product} can do for you.",
                "cta_label": "Set preferences" if reengage else "Explore now",
                "preference_options": REENGAGEMENT_PREFS["en"] if reengage else [],
            },
            "fr": {
                "subject": "Choisissez vos sujets" if reengage else f"Le {product} est arrivé",
                "preheader": "Définissez vos sujets et la fréquence." if reengage else f"Conçu en pensant à vous.",
                "headline": "Votre boîte, vos règles" if reengage else f"Découvrez le {product}",
                "body": "Choisissez les sujets qui vous intéressent et la fréquence des courriels. Vous pouvez modifier ces choix à tout moment." if reengage else f"{idea['fr']}\n\nDécouvrez tout ce que le {product} peut faire pour vous.",
                "cta_label": "Définir mes préférences" if reengage else "Découvrir",
                "preference_options": REENGAGEMENT_PREFS["fr"] if reengage else [],
            }
        }
    return acc
