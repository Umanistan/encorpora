import os
import requests
import json
import anthropic
from typing import Any

class HybridLLMProvider:
    def __init__(self, provider_type: str, completion_model: str = "gpt-4o"):
        self.provider_type = provider_type
        self.completion_model = completion_model
        self.lm_studio_url = "http://host.docker.internal:1234/v1/chat/completions"
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if api_key:
            self.anthropic_client = anthropic.Anthropic(api_key=api_key)
            self.use_api = True
        else:
            self.use_api = False
            print("No ANTHROPIC_API_KEY found, using LM Studio only")
    def get_data_completion(self, messages, response_model=None):
        if hasattr(self, 'use_api') and self.use_api:
            try:
                return self._try_api(messages)
            except Exception as e:
                print(f"API failed: {e}, falling back to LM Studio")
        return self._try_lm_studio(messages)
    def _try_api(self, messages):
        # Use exact same code as working manual test
        import time
        time.sleep(2)
        try:
            response = self.anthropic_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                messages=[{"role": "user", "content": "Translate to Polish: She laughed once during the show."}],
                max_tokens=1000
            )
            content = response.content[0].text
            print("DEBUG: API call successful!")
            return self._parse_response(messages, content)
        except Exception as e:
            print(f"DEBUG: API failed: {type(e)} - {str(e)}")
            raise e
        import time
        time.sleep(5)  # Longer delay to avoid rate limiting
        user_content = "Translate to Polish: " + " ".join([f"{msg.text}" for msg in messages if msg.role == "user"])
        for attempt in range(3):
            try:
                response = self.anthropic_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    messages=[{"role": "user", "content": user_content}],
                    max_tokens=1000
                )
                content = response.content[0].text
                return self._parse_response(messages, content)
            except Exception as e:
                print(f"DEBUG: API attempt {attempt + 1} failed: {type(e)} - {str(e)}")
                if attempt < 2:
                    time.sleep(10)
                    continue
                else:
                    raise e
                if attempt < 2:
                    time.sleep(10)
                    continue
                else:
                    raise e
    def _try_lm_studio(self, messages):
        openai_messages = []
        for msg in messages:
            openai_messages.append({"role": msg.role, "content": msg.text})
        payload = {"model": self.completion_model, "messages": openai_messages, "temperature": 0.7, "max_tokens": 2000}
        try:
            response = requests.post(self.lm_studio_url, json=payload, timeout=120)
            response.raise_for_status()
            result = response.json()
            content = result['choices'][0]['message']['content']
            return self._parse_response(messages, content)
        except Exception as e:
            print(f"Error calling LM Studio: {e}")
            return self._create_empty_response()
    def _parse_response(self, messages, content):
        last_message = messages[-1].text
        lines = last_message.split('\n')
        mock_translations = []
        for line in lines:
            if ':' in line:
                parts = line.split(':', 1)
                if len(parts) == 2:
                    entry_id = int(parts[0].strip())
                    class MockTranslatedSentence:
                        def __init__(self, entry_id, translated_text):
                            self.entry_id = entry_id
                            self.translated_text = translated_text
                    mock_translations.append(MockTranslatedSentence(entry_id, content))
        class MockResponse:
            def __init__(self, translations):
                self.translations = translations
        return MockResponse(mock_translations)
    def _create_empty_response(self):
        class MockResponse:
            def __init__(self):
                self.translations = []
        return MockResponse()

def load_llm_provider(provider_type: str, completion_model: str = "gpt-4o") -> Any:
    return HybridLLMProvider(provider_type, completion_model)
