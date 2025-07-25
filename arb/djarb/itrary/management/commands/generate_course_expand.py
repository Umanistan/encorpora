"""
With generate_course, lessons are created together for the whole unit.
This is good for making sure that they don't overlap and step on each other.
But, because the LLM is producing them all at once, it is sometimes short
and not as deep and rich as it could be.

This command will go lesson to lesson and instruct the LLM to expand on the
lesson without creating overlap.

- expand lesson
- stay in lane, go deep, don't mention things that will be in other lessons
- bold, italics, blockquotes, make it pretty
- keep the EXACT same images (captions) but, can move them around if it makes
  sense
"""

from django.core.management.base import BaseCommand

from corpora_ai.provider_loader import load_llm_provider
from itrary.models import Course, Unit
from itrary.agents import (
    edit_unit,
)
from itrary.utils import load_book_config  # Utility to load YAML (to be defined)

INSTRUCTIONS = (
    "The lessons were generated by an LLM and are a bit too short and not as deep and rich as they could be.\n"
    "Your job is to expand on the disparate facts and stories as much as you can to make the lessons more full.\n"
    "Don't add fluffy filler language. We still want the language to be very simple and clear. "
    "But, expand by going deeper, adding more facts, details, stories, and things to comtemplate. "
    "Stay narrowly within the subject of the lesson and don't mention things that will be in other lessons.\n"
    "Instead of going wide with trite boilerplate, go deep into the subject of the lesson and make it rich, full, exhaustive, and compelling.\n"
    "You are expanding the lessons but don't waste words.\n"
    "You keep the lesson fact-dense and concise.\n"
    "Ensure that the lessons are 100% historically accurate.\n"
    "If there is debate about a fact, present both sides neutrally.\n"
    "Make the markdown content pretty and engaging with judicious use of bold, italics, blockquotes, bullets, subheaders, etc, WHERE ADDITIONAL MARKDOWN FEATURES WOULD ADD VALUE.\n"
    "Keep the EXACT SAME image tokens with the EXACT SAME captions; but, feel free to move them around to intersperse them with the text, if it makes sense.\n"
    # "You can keep the exercises essentially the same, perhaps adding markdown features to make them more engaging."
)

openai = load_llm_provider("openai")


class Command(BaseCommand):
    help = "Generate a course skeleton with units, lessons, and exercises for a book"

    def add_arguments(self, parser):
        parser.add_argument(
            "--config",
            type=str,
            default=None,
            help="Path to config YAML (e.g., 'book-input/georgia-state-history/config.yaml')",
        )

    def handle(self, *args, **options):
        config = load_book_config(options["config"])
        course_title = config.title
        course = Course.objects.get(name=course_title)
        self.stdout.write(f"Expanding course: {course_title}\n")

        for unit in course.units.all():
            self.stdout.write(f"Expanding unit: {unit.name}\n")
            unit: Unit
            edit_unit(
                unit.name,
                INSTRUCTIONS,
                config=config,
                llm=openai,
            )

        self.stdout.write("Done expanding course.\n")
