class ChatCompletionTextMessage:
    def __init__(self, role: str, text: str):
        self.role = role
        self.text = text
