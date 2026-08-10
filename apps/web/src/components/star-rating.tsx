import { Star } from "lucide-react";

export function StarRating({
  rating,
  count,
  compact = false,
}: {
  rating: number;
  count?: number;
  compact?: boolean;
}) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-2 text-sm text-stone-700">
      <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            aria-hidden="true"
            className={`h-4 w-4 ${index < rounded ? "fill-amber-500 text-amber-500" : "text-stone-300"}`}
          />
        ))}
      </div>
      {!compact && <span>{rating.toFixed(1)}</span>}
      {typeof count === "number" && <span className="text-stone-500">({count})</span>}
    </div>
  );
}

