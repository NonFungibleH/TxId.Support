-- Add watchedContracts array to the default config for new projects.
alter table projects
  alter column config set default '{
    "branding": {
      "primaryColor": "#6366f1",
      "secondaryColor": "#4f46e5",
      "backgroundColor": "#0f0f0f",
      "textColor": "#ffffff",
      "font": "Inter",
      "logoUrl": null,
      "position": "bottom-right",
      "theme": "dark"
    },
    "token": null,
    "chains": ["0x1", "0x2105", "0x38", "0x89", "0xa4b1", "0xa"],
    "contentBlocks": [],
    "docsUrl": null,
    "allowedDomains": [],
    "watchedContracts": []
  }'::jsonb;

-- Backfill existing rows that don't have watchedContracts yet
update projects
set config = jsonb_set(config, '{watchedContracts}', '[]'::jsonb, true)
where config -> 'watchedContracts' is null;
