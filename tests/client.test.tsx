import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { newRequestId } from '../apps/web/src/requestId';
import { PromptText } from '../apps/web/src/components';
import { BaseActionSchema } from '@card-chaos/shared';
describe('client compatibility and prompt rendering', () => {
  it('creates valid unique request IDs without secure-context randomUUID', () => {
    const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
    const ids = Array.from({ length: 100 }, () => newRequestId(source));
    expect(new Set(ids).size).toBe(100);
    expect(ids.every((requestId) => BaseActionSchema.safeParse({ requestId }).success)).toBe(true);
  });
  it('preserves answer order and escapes custom text in the completed prompt', () => {
    const html = renderToStaticMarkup(
      <PromptText
        text="Mix ____ with ____."
        answers={['First answer', '<script>alert(1)</script>']}
      />,
    );
    expect(html.indexOf('First answer')).toBeLessThan(html.indexOf('&lt;script&gt;'));
    expect(html).not.toContain('<script>');
  });
  it('shows all answers when a question has no literal blank', () => {
    const html = renderToStaticMarkup(
      <PromptText text="What made this party unforgettable?" answers={['First', 'Second']} />,
    );
    expect(html).toContain('First + Second');
  });
});
