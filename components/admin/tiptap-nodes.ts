import { Node, mergeAttributes } from '@tiptap/core';

export const IframeEmbed = Node.create({
  name: 'iframeEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: 'Видео' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src]',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          return { src: node.getAttribute('src'), title: node.getAttribute('title') ?? 'Видео' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'iframe',
      mergeAttributes(HTMLAttributes, {
        width: '100%',
        frameborder: '0',
        allowfullscreen: 'true',
        allow: 'accelerometer; autoplay; encrypted-media; picture-in-picture',
        class: 'w-full aspect-video rounded-sm border border-line bg-ink/90 my-4',
      }),
    ];
  },
});

export const HtmlVideo = Node.create({
  name: 'htmlVideo',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          return {
            src: node.getAttribute('src') ?? node.querySelector('source')?.getAttribute('src'),
            controls: node.hasAttribute('controls'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { controls, ...rest } = HTMLAttributes as { controls: boolean | string; src: string };
    const attrs: Record<string, string> = { ...rest };
    if (controls === true || controls === 'true' || controls === '') attrs.controls = '';
    return ['video', mergeAttributes(attrs, { class: 'w-full my-4 rounded-sm bg-ink/90' })];
  },
});
