from django.core.management.base import BaseCommand
from cor.models import Language


class Command(BaseCommand):
    help = "Add Polish language to the database"

    def handle(self, *args, **options):
        # Check if Polish already exists
        if Language.objects.filter(code="pl").exists():
            self.stdout.write(
                self.style.WARNING("Polish language already exists in the database.")
            )
            return

        # Create Polish language record
        polish_language = Language.objects.create(
            code="pl",
            name="Polish"
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully added Polish language (code: {polish_language.code}, name: {polish_language.name})"
            )
        )
