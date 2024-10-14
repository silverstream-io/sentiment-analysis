from dataclasses import dataclass

@dataclass
class Emotion:

    def __init__(self, name: str, score: float):
        self.name = name
        self.score = score

    def __str__(self):
        return self.name
    
    def __repr__(self):
        return f"Emotion(name={self.name}, score={self.score})"
    
    def __eq__(self, other):
        return self.score == other.score
 
    def __ne__(self, other):
        return self.score != other.score    
    
    def __lt__(self, other):
        return self.score < other.score
    
    def __gt__(self, other):
        return self.score > other.score
    
    def __le__(self, other):
        return self.score <= other.score
    
    def __ge__(self, other):
        return self.score >= other.score
   

emotions = {
    "example_very_unclear": Emotion("example_very_unclear", 0.0),
    "admiration": Emotion("admiration", 1.5),
    "amusement": Emotion("amusement", 1.0),
    "anger": Emotion("anger", -2.0),
    "annoyance": Emotion("annoyance", -1.0),
    "approval": Emotion("approval", 1.0),
    "caring": Emotion("caring", 1.5),
    "confusion": Emotion("confusion", -0.5),
    "curiosity": Emotion("curiosity", 0.5),
    "desire": Emotion("desire", 1.0),
    "disappointment": Emotion("disappointment", -1.5),
    "disapproval": Emotion("disapproval", -1.5),
    "disgust": Emotion("disgust", -2.0),
    "embarrassment": Emotion("embarrassment", -1.0),
    "excitement": Emotion("excitement", 2.0),
    "fear": Emotion("fear", -1.5),
    "gratitude": Emotion("gratitude", 2.0),
    "grief": Emotion("grief", -1.5),
    "joy": Emotion("joy", 2.0),
    "love": Emotion("love", 2.0),
    "nervousness": Emotion("nervousness", -0.5),
    "optimism": Emotion("optimism", 1.5),
    "pride": Emotion("pride", 1.5),
    "realization": Emotion("realization", 1.0),
    "relief": Emotion("relief", 1.5),
    "remorse": Emotion("remorse", -1.5),
    "sadness": Emotion("sadness", -1.5),
    "surprise": Emotion("surprise", 0.5),
    "neutral": Emotion("neutral", 0.0)
}