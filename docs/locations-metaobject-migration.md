# Locations page: Shopify admin migration

Use this guide to connect the `page.locations` alternate template to the
existing location metaobjects. The theme reads those records; it does not
create, update, or otherwise mutate metaobjects or their relationships.

## 1. Assign the Locations page template

1. In Shopify admin, open **Online Store > Pages** and select the Locations
   page (or create it).
2. In **Theme template**, choose `page.locations` and save the page.
3. Open that page in the Theme Editor. The template contains **Locations
   header**, **Locations store finder**, and **Locations flagships**.

The original `page` template remains separate; assigning `page.locations`
does not change other pages that use `page`.

## 2. Confirm the metaobject definitions

The template expects these existing definitions and field keys:

| Definition | Field keys used by the theme |
| --- | --- |
| `store_location` | `title`, `storeaddress`, `suburb`, `state`, `latitude`, `longitude`, `time`, `overview`, `storeaddressurl`, `image`, `tags` |
| `store_tag` | `label`, `slug` |

`tags` must be a reference from a `store_location` record to one or more
`store_tag` records. The finder reads every `store_location` record and uses
the related tag labels and slugs for its venue filter.

Populate the fields appropriate for each location. A location without
coordinates remains in the list, but cannot receive a map marker or a
distance calculation. `image`, website, hours, and overview are rendered
only when provided.

## 3. Create or reuse the flagship tag

1. In **Content > Metaobjects**, open `store_tag` entries.
2. Reuse the entry whose `slug` is exactly `flagship`, or create one with a
   suitable `label` and the exact slug `flagship`.
3. Open each flagship `store_location` entry and add that `store_tag` entry
   to its `tags` field.

The flagship section selects locations solely through this relationship and
slug. It does not use a blog, legacy metafields, or any theme-side data
migration.

## 4. Optionally add a flagship gallery

For multi-image flagship cards, add an optional `gallery` field to the
`store_location` definition as a **list of file/image references**, then add
images to it on the relevant location records. The flagship section renders
the image references it can display. If `gallery` is absent, empty, or has no
renderable image, it falls back to that location's existing `image` field.

The page continues to work without `gallery`; it is not required for the
store finder or the flagship content.

## 5. Configure the page in Theme Editor

Open the Locations page with the `page.locations` template in the Theme
Editor.

- **Locations header** controls heading/body copy, typography presets and
  size, width, alignment, colors, and padding.
- **Locations store finder** controls copy and status messages, the Google
  Maps API key, default list/map view, default radius, enabled state/venue/
  radius filters, width, colors (including cards), and padding.
- **Locations flagships** controls heading/introduction and website-link
  copy, width/alignment, media aspect ratio and fit, colors, and padding.

Enter the Google Maps browser API key in **Locations store finder > Google
Maps API key**. Keep the key in this Theme Editor setting rather than source
control. A valid key allows the map view to load; only locations with
coordinates receive map markers. The location list itself does not need a
key.

## 6. Verify the storefront

Preview the Locations page at desktop and mobile widths. Check the location
list, text/state/venue filters, directions and website links, flagship cards,
and gallery controls where multiple gallery images exist. If a Google Maps
key is configured, also check the map view and markers.

When the Maps key is missing, the Maps script fails to load, or matching
locations have no coordinates, the theme keeps the accessible list available
and displays a non-blocking map status. If geolocation is unavailable, search
and the other filters continue to work.
