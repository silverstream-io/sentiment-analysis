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
    "admiration": Emotion("admiration", 7.5),
    "amusement": Emotion("amusement", 5.0),
    "anger": Emotion("anger", -10.0),
    "annoyance": Emotion("annoyance", -5.0),
    "approval": Emotion("approval", 5.0),
    "caring": Emotion("caring", 7.5),
    "confusion": Emotion("confusion", -2.5),
    "curiosity": Emotion("curiosity", 2.5),
    "desire": Emotion("desire", 5.0),
    "disappointment": Emotion("disappointment", -7.5),
    "disapproval": Emotion("disapproval", -7.5),
    "disgust": Emotion("disgust", -9.0),
    "embarrassment": Emotion("embarrassment", -5.0),
    "excitement": Emotion("excitement", 9.0),
    "fear": Emotion("fear", -7.5),
    "gratitude": Emotion("gratitude", 9.0),
    "grief": Emotion("grief", -7.5),
    "joy": Emotion("joy", 10.0),
    "love": Emotion("love", 10.0),
    "nervousness": Emotion("nervousness", -2.5),
    "optimism": Emotion("optimism", 7.5),
    "pride": Emotion("pride", 7.5),
    "realization": Emotion("realization", 5.0),
    "relief": Emotion("relief", 7.5),
    "remorse": Emotion("remorse", -7.5),
    "sadness": Emotion("sadness", -7.5),
    "surprise": Emotion("surprise", 2.5),
    "neutral": Emotion("neutral", 0.0)
}
