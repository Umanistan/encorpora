import { useSettingsStore, ALL_TEXT_SIZES, TextSizeType } from "@/store/settings";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function TextSizeAdjuster() {
    const textSize = useSettingsStore((s) => s.textSize);
    const setTextSize = useSettingsStore((s) => s.setTextSize);
    const t = useSettingsStore((s) => s.t);

    return (
        <div className="py-4">
            <Label htmlFor="text-size-adjuster" className="block text-sm font-medium text-gray-700 mb-2">
                {t("Text Size")}
            </Label>
            <div className="flex flex-wrap gap-2" id="text-size-adjuster">
                {ALL_TEXT_SIZES.map((size) => (
                    <Button
                        key={size}
                        variant={textSize === size ? "default" : "outline"}
                        onClick={() => setTextSize(size as TextSizeType)}
                        className="capitalize"
                    >
                        {t(size as any) || size} 
                    </Button>
                ))}
            </div>
        </div>
    );
}
