import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// src/utils/lucideIconResolver.ts
// Resolves a theme's lyricsIcons entry (a PascalCase lucide name coming from AI output or the
// theme editor) to a renderable component, so callers never index lucide-react by hand.

// lucide icons are forwardRef objects; requiring that shape keeps the module's other exports
// (createLucideIcon, the icons map, ...) from passing as icon names.
const isLucideIcon = (value: unknown): value is LucideIcon => (
    typeof value === 'object' && value !== null && '$$typeof' in value && 'render' in value
);

export const resolveLucideIcon = (name: string | null | undefined): LucideIcon | null => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
        return null;
    }

    const candidate = (LucideIcons as unknown as Record<string, unknown>)[trimmed];
    return isLucideIcon(candidate) ? candidate : null;
};

export const isLucideIconName = (name: string) => resolveLucideIcon(name) !== null;
