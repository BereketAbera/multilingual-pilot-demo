// The Handoff page's one figure: where a message from the backend goes. The drawings, their
// names and their description are written by design/make_assets.py, which reads the codes and the
// Portuguese message from the app's own files. The drawings are placed inline, not as image
// files, so the words stay text in the page's own fonts.

import names from '../../assets/diagrams/backend-messages.json';
import path1 from '../../assets/diagrams/backend-messages-path-1.svg?raw';
import path2 from '../../assets/diagrams/backend-messages-path-2.svg?raw';
import path3 from '../../assets/diagrams/backend-messages-path-3.svg?raw';
import wide from '../../assets/diagrams/backend-messages-wide.svg?raw';
import description from '../../assets/diagrams/backend-messages.txt?raw';

const fit = '[&>svg]:h-auto [&>svg]:w-full';
const paths = [path1, path2, path3].map((drawing, index) => ({ ...names.paths[index], drawing }));

/**
 * Three layouts from two drawings. Four columns with a row for each path where the panel can show
 * that at full size. Below that each path is its own drawing, top to bottom: the three side by
 * side while there is room for them, and one under the other on a phone. A screen reader gets
 * one image with a name, and the hidden paragraph as its description, whichever is showing.
 */
export function BackendMessagePaths() {
  return (
    <figure data-testid="backend-paths">
      <div className={`hidden xl:block ${fit}`} dangerouslySetInnerHTML={{ __html: wide }} />
      <div
        role="img"
        aria-label={names.title}
        aria-describedby="backend-messages-description"
        className="grid max-w-[15rem] gap-x-4 gap-y-2 lg:max-w-none lg:grid-flow-col lg:grid-cols-3 lg:grid-rows-[auto_auto] xl:hidden"
      >
        {paths.flatMap((path, index) => [
          <p key={path.label} className={`text-sm leading-snug ${index ? 'max-lg:mt-4' : ''}`}>
            <span className={`block font-semibold ${path.fallback ? 'text-tool' : 'text-action'}`}>{path.label}</span>
            <span className="block text-[0.8125rem] text-muted">{path.note}</span>
          </p>,
          <div key={`${path.label} drawing`} className={fit} dangerouslySetInnerHTML={{ __html: path.drawing }} />,
        ])}
      </div>
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
