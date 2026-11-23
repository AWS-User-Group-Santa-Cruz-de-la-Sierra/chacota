import { describe, expect, it } from 'vitest';
import { frameOnEvent } from '../src/client/frame';

describe('frameOnEvent', () => {
  it('starts the activity on "started"', () => {
    expect(frameOnEvent('lobby', 'started')).toEqual({ status: 'running', restart: true });
  });

  it('starts it too when an activity event overtakes "started"', () => {
    expect(frameOnEvent('lobby', 'tiluchi.question')).toEqual({ status: 'running', restart: true, deliver: true });
    // The late "started" must not throw away the question that already arrived.
    expect(frameOnEvent('running', 'started')).toEqual({ status: 'running', restart: false });
  });

  it('delivers activity events while running and ends on "ended"', () => {
    expect(frameOnEvent('running', 'tiluchi.reveal')).toEqual({ status: 'running', restart: false, deliver: true });
    expect(frameOnEvent('running', 'ended')).toEqual({ status: 'ended', restart: false });
    expect(frameOnEvent('ended', 'tiluchi.reveal')).toEqual({ status: 'ended', restart: false });
  });
});
