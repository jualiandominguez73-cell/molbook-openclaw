/**
 * Tests for parameter parser
 */

import { describe, it, expect } from 'vitest';
import { parseParameters, applyParameterChanges } from './parameter-parser.js';

describe('parseParameters', () => {
  it('should parse basic number parameters', () => {
    const code = `
// Height of the object
height = 100;
width = 50;
    `.trim();

    const params = parseParameters(code);

    expect(params).toHaveLength(2);
    expect(params[0]).toMatchObject({
      name: 'height',
      type: 'number',
      value: 100,
      description: 'Height of the object',
    });
    expect(params[1]).toMatchObject({
      name: 'width',
      type: 'number',
      value: 50,
    });
  });

  it('should parse boolean parameters', () => {
    const code = 'show_supports = true;';
    const params = parseParameters(code);

    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({
      name: 'show_supports',
      type: 'boolean',
      value: true,
    });
  });

  it('should parse string parameters', () => {
    const code = 'model_name = "test";';
    const params = parseParameters(code);

    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({
      name: 'model_name',
      type: 'string',
      value: 'test',
    });
  });

  it('should parse parameters with ranges', () => {
    const code = 'height = 100; // 10:200:10';
    const params = parseParameters(code);

    expect(params[0].range).toEqual({
      min: 10,
      max: 200,
      step: 10,
    });
  });

  it('should ignore module and function parameters', () => {
    const code = `
height = 100;

module test() {
  inner_height = 50;
}
    `.trim();

    const params = parseParameters(code);
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('height');
  });
});

describe('applyParameterChanges', () => {
  it('should update number parameters', () => {
    const code = 'height = 100;';
    const updated = applyParameterChanges(code, [{ name: 'height', value: 150 }]);

    expect(updated).toBe('height = 150;');
  });

  it('should update boolean parameters', () => {
    const code = 'show_supports = true;';
    const updated = applyParameterChanges(code, [{ name: 'show_supports', value: false }]);

    expect(updated).toBe('show_supports = false;');
  });

  it('should update string parameters', () => {
    const code = 'name = "old";';
    const updated = applyParameterChanges(code, [{ name: 'name', value: 'new' }]);

    expect(updated).toBe('name = "new";');
  });

  it('should preserve comments', () => {
    const code = 'height = 100; // Height in mm';
    const updated = applyParameterChanges(code, [{ name: 'height', value: 150 }]);

    expect(updated).toBe('height = 150; // Height in mm');
  });

  it('should handle multiple parameter changes', () => {
    const code = `
height = 100;
width = 50;
    `.trim();

    const updated = applyParameterChanges(code, [
      { name: 'height', value: 150 },
      { name: 'width', value: 75 },
    ]);

    expect(updated).toContain('height = 150;');
    expect(updated).toContain('width = 75;');
  });
});
