from pydantic import BaseModel

class IdeaItem(BaseModel):
    en: str
    headline_en: str
    body_en: str

class IdeasList(BaseModel):
    ideas: list[IdeaItem]

class TranslatedIdeaItem(BaseModel):
    fr: str
    headline_fr: str
    body_fr: str

class TranslatedIdeasList(BaseModel):
    ideas: list[TranslatedIdeaItem]

class QualityCheckItem(BaseModel):
    criterion: str
    status: str
    note: str

class MetricScores(BaseModel):
    correctness: float
    groundedness: float
    relevance: float
    completeness: float
    conciseness: float
    safety: float

class QualityReport(BaseModel):
    overall: str
    checks: list[QualityCheckItem]
    metrics: MetricScores

class ImageCopy(BaseModel):
    headline: str
    body: str

class ImageAssetItem(BaseModel):
    en: ImageCopy
    fr: ImageCopy

class ImageAssetsList(BaseModel):
    assets: list[ImageAssetItem]

class VideoCopy(BaseModel):
    hook: str
    scenes: list[str]
    cta: str

class VideoAssetItem(BaseModel):
    en: VideoCopy
    fr: VideoCopy

class VideoAssetsList(BaseModel):
    assets: list[VideoAssetItem]

class EmailCopy(BaseModel):
    subject: str
    preheader: str
    headline: str
    body: str
    cta_label: str
    preference_options: list[str]

class EmailAssetItem(BaseModel):
    en: EmailCopy
    fr: EmailCopy

class EmailAssetsList(BaseModel):
    assets: list[EmailAssetItem]
