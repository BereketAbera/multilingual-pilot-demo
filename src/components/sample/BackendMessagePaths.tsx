// The Handoff page's one figure: where a message from the backend goes. Both drawings and their
// description are written by design/make_assets.py, which reads the codes and the Portuguese
// message from the app's own files. The drawings are placed inline, not as image files, so the
// words stay text in the page's own fonts.

import narrow from '../../assets/diagrams/backend-messages-narrow.svg?raw';
import wide from '../../assets/diagrams/backend-messages-wide.svg?raw';
import description from '../../assets/diagrams/backend-messages.txt?raw';

const fit = '[&>svg]:h-auto [&>svg]:w-full';

/**
 * Side by side where the panel is wide enough to show the drawing at full size, top to bottom
 * everywhere else. A screen reader gets the drawing as one image with a title, and the hidden
 * paragraph as its description, whichever of the two is showing.
 */
export function BackendMessagePaths() {
  return (
    <figure data-testid="backend-paths">
      <div className={`hidden xl:block ${fit}`} dangerouslySetInnerHTML={{ __html: wide }} />
      <div className={`max-w-[22.5rem] xl:hidden ${fit}`} dangerouslySetInnerHTML={{ __html: narrow }} />
      <p id="backend-messages-description" hidden>
        {description}
      </p>
      <figcaption className="mt-3 text-sm text-muted">
        Solid blue is the normal case. The dashed violet paths are the two fallbacks, and in both the user reads the
        server’s own English.
      </figcaption>
    </figure>
  );
}
