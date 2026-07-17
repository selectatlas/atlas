import Link from "next/link";
import Image from "next/image";
import { Eye, Heart, MapPin } from "lucide-react";
import type { Profile, TalentSkill } from "@/types";
import { CATEGORY_LABELS } from "@/lib/skills";
import { nameInitial } from "@/lib/display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShortlistButton } from "@/components/talent/ShortlistButton";
import { VerifiedBadge } from "@/components/talent/VerifiedBadge";
import { TalentLevelBadge } from "@/components/talent/TalentLevelBadge";
import type { TalentLevel } from "@/lib/talent-level";

interface TalentCardProps {
  profile: Profile & { talent_skills: TalentSkill[] };
  matchScore?: number;
  matchReasons?: string[];
  href?: string;
  views?: number;
  likes?: number;
  level?: TalentLevel;
}

const proficiencyVariant: Record<string, "default" | "secondary" | "outline"> =
  {
    expert: "default",
    advanced: "secondary",
    intermediate: "outline",
    beginner: "outline",
  };

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function locationFor(profile: Profile) {
  return [profile.city, profile.country].filter(Boolean).join(", ");
}

export function TalentCard({
  profile,
  matchScore,
  matchReasons,
  href,
  views,
  likes,
  level,
}: TalentCardProps) {
  const topSkills = profile.talent_skills.slice(0, 3);
  const primaryCategory = profile.talent_skills[0]?.category;
  const location = locationFor(profile);

  const cardContent = (
    <Card className="group gap-0 overflow-hidden border border-border/80 pt-0 shadow-none transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35">
      <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.full_name}
              fill
              className="object-cover object-top transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl font-semibold text-muted-foreground/30">
              {nameInitial(profile.full_name)}
            </div>
          )}
        </div>

        {matchScore !== undefined && (
          <div className="absolute right-3 top-3 rounded-full bg-brand-lime px-2.5 py-1 text-xs font-bold text-black">
            {matchScore}% match
          </div>
        )}

        {primaryCategory && (
          <div className="absolute left-3 top-3 rounded-md border border-white/60 bg-background/85 px-2 py-1 text-[11px] font-medium text-foreground backdrop-blur-sm">
            {CATEGORY_LABELS[primaryCategory]}
          </div>
        )}

        <div className="absolute bottom-3 right-3 opacity-100 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <ShortlistButton
            talentId={profile.id}
            className="bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background"
          />
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold leading-tight">
                {profile.full_name}
              </h3>
              <VerifiedBadge
                verifiedAt={profile.verified_at}
                categories={profile.verified_categories}
                compact
              />
              <TalentLevelBadge level={level} />
            </div>
            {profile.headline && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {profile.headline}
              </p>
            )}
            {location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
                <MapPin className="size-3" />
                <span className="truncate">{location}</span>
              </p>
            )}
          </div>
          {profile.rates && (
            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-foreground/75">
              {profile.rates.split("/")[0].trim()}
            </span>
          )}
        </div>

        {matchReasons && matchReasons.length > 0 && (
          <div
            className="mt-3 flex flex-wrap gap-1.5"
            aria-label="Why this talent matches"
          >
            {matchReasons.map((reason) => (
              <span
                key={reason}
                className="inline-flex max-w-full items-center truncate rounded-full bg-secondary/70 px-2 py-1 text-[10px] font-medium text-secondary-foreground"
              >
                {reason}
              </span>
            ))}
          </div>
        )}

        {topSkills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {topSkills.map((skill) => (
              <Badge
                key={skill.id}
                variant={proficiencyVariant[skill.proficiency] ?? "outline"}
                className="text-[11px]"
              >
                {skill.skill}
              </Badge>
            ))}
            {profile.talent_skills.length > 3 && (
              <Badge variant="outline" className="text-[11px]">
                +{profile.talent_skills.length - 3}
              </Badge>
            )}
          </div>
        )}

        {(views !== undefined ||
          likes !== undefined ||
          profile.availability) && (
          <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              {views !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5" /> {formatCount(views)}
                </span>
              )}
              {likes !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Heart className="size-3.5" /> {formatCount(likes)}
                </span>
              )}
            </div>
            {profile.availability && (
              <span className="inline-flex max-w-[50%] items-center gap-1 truncate text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate">{profile.availability}</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href)
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    );
  return cardContent;
}

export function TalentListItem({
  profile,
  matchScore,
  matchReasons,
  href,
  views,
  likes,
  level,
}: TalentCardProps) {
  const topSkills = profile.talent_skills.slice(0, 2);
  const location = locationFor(profile);
  const content = (
    <Card className="group border border-border/80 p-3 shadow-none transition-[border-color,background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card">
      <div className="flex items-center gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-lg font-semibold text-muted-foreground/40">
              {nameInitial(profile.full_name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">
              {profile.full_name}
            </h3>
            <VerifiedBadge
              verifiedAt={profile.verified_at}
              categories={profile.verified_categories}
              compact
            />
            <TalentLevelBadge level={level} />
            {matchScore !== undefined && (
              <span className="shrink-0 rounded-full bg-brand-lime px-1.5 py-0.5 text-[10px] font-bold text-black">
                {matchScore}%
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {profile.headline || "Creative talent"}
          </p>
          {matchReasons && matchReasons.length > 0 && (
            <div
              className="mt-1 flex flex-wrap gap-1.5"
              aria-label="Why this talent matches"
            >
              {matchReasons.slice(0, 2).map((reason) => (
                <span
                  key={reason}
                  className="truncate rounded-full bg-secondary/70 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                >
                  {reason}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="hidden min-w-[150px] items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <MapPin className="size-3.5" />
          <span className="truncate">{location || "Location not listed"}</span>
        </div>
        <div className="hidden min-w-[170px] items-center gap-1.5 md:flex">
          {topSkills.map((skill) => (
            <Badge key={skill.id} variant="outline" className="text-[10px]">
              {skill.skill}
            </Badge>
          ))}
          {profile.talent_skills.length > 2 && (
            <span className="text-[11px] text-muted-foreground">
              +{profile.talent_skills.length - 2}
            </span>
          )}
        </div>
        <div className="hidden w-24 shrink-0 text-right text-xs font-medium text-foreground/75 sm:block">
          {profile.rates?.split("/")[0].trim() || "Rate on request"}
        </div>
        <div className="hidden w-24 shrink-0 text-right text-[11px] text-emerald-600 dark:text-emerald-400 sm:block">
          {profile.availability || "—"}
        </div>
        <div className="shrink-0 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-[var(--duration-fast)] sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <ShortlistButton talentId={profile.id} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 pl-[60px] text-[11px] text-muted-foreground sm:hidden">
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {location}
          </span>
        )}
        {views !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3" />
            {formatCount(views)}
          </span>
        )}
        {likes !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3" />
            {formatCount(likes)}
          </span>
        )}
      </div>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
