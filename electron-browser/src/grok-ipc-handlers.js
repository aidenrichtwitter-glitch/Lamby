const { ipcMain, webContents } = require('electron');

const BROWSER_MODE_VERSION = 'v26.3';

const LOG = '[GROK-IPC]';

function findGrokWebviewContents() {
  const all = webContents.getAllWebContents();
  for (const wc of all) {
    try {
      const url = wc.getURL();
      if (wc.getType() === 'webview' && (url.includes('grok.com') || url.includes('x.com/i/grok'))) {
        return wc;
      }
    } catch (_) {}
  }
  for (const wc of all) {
    try {
      if (wc.getType() === 'webview') return wc;
    } catch (_) {}
  }
  return null;
}

const SELECTORS = {
  // Grok stop button: inside form input area at bottom, in div.ms-auto container
  // Selector from DOM: form > div > div > div.ps-11 > div...div.ms-auto > button (SVG icon, no text)
  stop: [
    'form div.ms-auto button',
    'button[aria-label="Stop"]',
    'button[aria-label="Stop generating"]',
  ],
  // Grok copy-response button: 4th button inside div.action-buttons on last response
  // Selector from DOM: div.action-buttons.last-response > div > button:nth-child(4) > span > svg
  copy: [
    'div.action-buttons.last-response > div > button:nth-child(4)',
    'div.action-buttons > div > button:nth-child(4)',
  ],
  // Action button toolbar that appears below each completed response
  // Has class "last-response" on the most recent one
  actionButtons: [
    'div.action-buttons.last-response',
    'div.action-buttons',
  ],
  // Like/dislike buttons: 1st and 2nd buttons in action-buttons bar
  reaction: [
    'div.action-buttons.last-response > div > button:nth-child(1)',
    'div.action-buttons.last-response > div > button:nth-child(2)',
    'div.action-buttons > div > button:nth-child(1)',
    'div.action-buttons > div > button:nth-child(2)',
  ],
  // Follow-up suggestion pills (still data-testid based — Grok may show these below responses)
  followUp: [
    'button[data-testid="suggested-prompt"]',
    'button[data-testid="follow-up"]',
    '[data-testid="suggestion-pill"]',
    '[data-testid="followup-suggestion"]',
  ],
  // Grok chat input: a div inside the form's input area
  // Selector from DOM: form > div > div > div.ps-11 > div.relative > div > div > div
  textarea: [
    'form div[class*="ps-11"] div[class*="relative"] div[contenteditable]',
    'form div[class*="ps-11"] div[class*="relative"] div > div > div',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[placeholder*="Ask"]',
  ],
  // Send button: same ms-auto area as stop, only visible when not generating
  // Selector from DOM: form > div > div > div.ps-11 > div...div.ms-auto > button
  sendButton: [
    'form div.ms-auto button',
    'button[type="submit"]',
  ],
  // Response containers: each response has id="response-{uuid}"
  // Selector from DOM: #response-424db704-... (UUID-based)
  response: [
    'div[id^="response-"]',
    '[data-testid="message-text"]',
    'div[data-message-author-role="assistant"]',
  ],
};

function buildSelectorChain(selectorList) {
  return selectorList.join(', ');
}

const SHARED_COUNTING_JS = `
  const __count = (selectors) => {
    try { return document.querySelectorAll(selectors).length; } catch(e) { return 0; }
  };
  const __stopSel = ${JSON.stringify(buildSelectorChain(SELECTORS.stop))};
  const __copySel = ${JSON.stringify(buildSelectorChain(SELECTORS.copy))};
  const __reactionSel = ${JSON.stringify(buildSelectorChain(SELECTORS.reaction))};
  const __followUpSel = ${JSON.stringify(buildSelectorChain(SELECTORS.followUp))};

  function __isGenerating() {
    const lastResponse = document.querySelector('div.action-buttons.last-response');
    if (lastResponse) return false;

    const allActionBars = document.querySelectorAll('div.action-buttons');
    const responseEls = document.querySelectorAll('div[id^="response-"]');
    if (responseEls.length > allActionBars.length) return true;

    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const text = (btn.textContent || '').trim().toLowerCase();
      if (label.includes('stop') || text === 'stop' || text === 'stop generating') return true;
    }
    return false;
  }

  function __countCopy() {
    const actionBars = document.querySelectorAll('div.action-buttons');
    if (actionBars.length > 0) return actionBars.length;
    let n = __count(__copySel);
    return n;
  }

  function __countReaction() {
    let n = __count(__reactionSel);
    if (n > 0) return n;
    const actionBars = document.querySelectorAll('div.action-buttons');
    for (const bar of actionBars) {
      const btns = bar.querySelectorAll('div > button');
      if (btns.length >= 2) n++;
    }
    return n;
  }

  function __countFollowUp() { return __count(__followUpSel); }
`;

function registerGrokIpcHandlers(getWebviewContents) {
  const resolveWc = getWebviewContents || findGrokWebviewContents;
  ipcMain.handle('grok-snapshot-baseline', async () => {
    try {
      const wc = resolveWc();
      if (!wc) return { success: false, error: 'No webview', generating: false, preCopyCount: 0, preReactionCount: 0, preFollowUpCount: 0 };

      const result = await wc.executeJavaScript(`(() => {
        ${SHARED_COUNTING_JS}
        const generating = __isGenerating();
        const preCopyCount = __countCopy();
        const preReactionCount = __countReaction();
        const preFollowUpCount = __countFollowUp();
        return { generating, preCopyCount, preReactionCount, preFollowUpCount };
      })()`);

      console.log(`${LOG} grok-snapshot-baseline: copy=${result.preCopyCount}, reactions=${result.preReactionCount}, followUps=${result.preFollowUpCount}, generating=${result.generating}`);
      return { success: true, ...result };
    } catch (err) {
      console.error(`${LOG} grok-snapshot-baseline error:`, err.message);
      return { success: false, error: err.message, generating: false, preCopyCount: 0, preReactionCount: 0, preFollowUpCount: 0 };
    }
  });

  ipcMain.handle('grok-check-response-ready', async (_event, baseline) => {
    try {
      const wc = resolveWc();
      if (!wc) return { ready: false, generating: false, version: BROWSER_MODE_VERSION, signals: 'no-webview' };

      const result = await wc.executeJavaScript(`(() => {
        ${SHARED_COUNTING_JS}
        return {
          generating: __isGenerating(),
          copyCount: __countCopy(),
          reactionCount: __countReaction(),
          followUpCount: __countFollowUp(),
        };
      })()`);

      const preCopy = baseline?.preCopyCount ?? baseline?.preMessageCount ?? 0;
      const preReaction = baseline?.preReactionCount ?? 0;
      const preFollowUp = baseline?.preFollowUpCount ?? 0;

      const newCopy = result.copyCount > preCopy;
      const newReaction = result.reactionCount > preReaction;
      const newFollowUp = result.followUpCount > preFollowUp;
      const ready = !result.generating && (newCopy || newReaction || newFollowUp);

      const signals = [];
      if (newCopy) signals.push(`NEW-copy(${result.copyCount}>${preCopy})`);
      if (newReaction) signals.push(`NEW-reaction(${result.reactionCount}>${preReaction})`);
      if (newFollowUp) signals.push(`NEW-followUp(${result.followUpCount}>${preFollowUp})`);
      if (result.generating) signals.push('GENERATING');

      return {
        ready,
        generating: result.generating,
        signals: signals.join(', ') || `copy=${result.copyCount}/${preCopy}, react=${result.reactionCount}/${preReaction}, follow=${result.followUpCount}/${preFollowUp}`,
        stopDebug: `generating=${result.generating}`,
        version: BROWSER_MODE_VERSION,
      };
    } catch (err) {
      console.error(`${LOG} grok-check-response-ready error:`, err.message);
      return { ready: false, generating: false, version: BROWSER_MODE_VERSION, signals: `error: ${err.message}` };
    }
  });

  ipcMain.handle('grok-copy-last-response', async () => {
    try {
      const wc = resolveWc();
      if (!wc) return { success: false, error: 'No webview' };

      const copySel = buildSelectorChain(SELECTORS.copy);
      const responseSel = buildSelectorChain(SELECTORS.response);

      const { clipboard } = require('electron');

      clipboard.writeText('__CLIPBOARD_CLEAR__');

      const clickResult = await wc.executeJavaScript(`(async () => {
        const actionBar = document.querySelector('div.action-buttons.last-response');
        if (!actionBar) return { clicked: false, error: 'no-action-buttons-last-response' };
        const btn = actionBar.querySelector('div > button:nth-child(4)');
        if (!btn) return { clicked: false, error: 'no-4th-button-in-action-bar' };
        btn.click();
        return { clicked: true };
      })()`);

      if (clickResult.clicked) {
        await new Promise(r => setTimeout(r, 400));

        let clipText = clipboard.readText();

        if (!clipText || clipText === '__CLIPBOARD_CLEAR__' || clipText.trim().length < 10) {
          try {
            clipText = await wc.executeJavaScript(`(async () => {
              try { return await navigator.clipboard.readText(); } catch { return null; }
            })()`);
          } catch {}
        }

        if (clipText && clipText !== '__CLIPBOARD_CLEAR__' && clipText.trim().length > 10) {
          console.log(`${LOG} grok-copy-last-response: success=true, len=${clipText.length}, method=action-buttons-copy`);
          return { success: true, text: clipText.trim(), findMethod: 'action-buttons-copy' };
        }
        console.log(`${LOG} grok-copy-last-response: copy button clicked but clipboard empty/unchanged. Falling back to DOM scrape.`);
      } else {
        console.log(`${LOG} grok-copy-last-response: ${clickResult.error}. Falling back to DOM scrape.`);
      }
      const domResult = await wc.executeJavaScript(`(() => {
        let messages = document.querySelectorAll('div[id^="response-"]');

        if (messages.length === 0) {
          const responseSelectors = ${JSON.stringify(responseSel)};
          messages = document.querySelectorAll(responseSelectors);
        }

        if (messages.length === 0) {
          return { success: false, error: 'No response messages found in DOM' };
        }

        const last = messages[messages.length - 1];
        const text = (last.innerText || last.textContent || '').trim();
        if (!text || text.length < 5) {
          return { success: false, error: 'Last response is empty or too short' };
        }
        return { success: true, text, findMethod: 'dom-response-id' };
      })()`);

      console.log(`${LOG} grok-copy-last-response: success=${domResult.success}, len=${domResult.text ? domResult.text.length : 0}, method=${domResult.findMethod || 'n/a'}, error=${domResult.error || 'none'}`);
      return domResult;
    } catch (err) {
      console.error(`${LOG} grok-copy-last-response error:`, err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('grok-extract-response', async (_event) => {
    try {
      const wc = resolveWc();
      if (!wc) return { success: false, error: 'No webview' };

      const result = await wc.executeJavaScript(`(() => {
        let messages = document.querySelectorAll('div[id^="response-"]');

        if (messages.length === 0) {
          const responseSelectors = ${JSON.stringify(buildSelectorChain(SELECTORS.response))};
          messages = document.querySelectorAll(responseSelectors);
        }

        if (messages.length === 0) return { success: false, error: 'No response found' };
        const last = messages[messages.length - 1];
        return { success: true, text: (last.innerText || '').trim() };
      })()`);

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('grok-send-prompt', async (_event, prompt) => {
    try {
      const wc = resolveWc();
      if (!wc) return { success: false, error: 'No webview' };

      const escapedPrompt = JSON.stringify(prompt);

      const result = await wc.executeJavaScript(`(async () => {
        ${SHARED_COUNTING_JS}
        const promptText = ${escapedPrompt};
        const textareaSelectors = ${JSON.stringify(buildSelectorChain(SELECTORS.textarea))};

        let input = null;

        const formInputs = document.querySelectorAll('form div[class*="ps-11"] div[class*="relative"] div');
        for (let i = formInputs.length - 1; i >= 0; i--) {
          const el = formInputs[i];
          if (el.children.length === 0 && el.offsetParent !== null) {
            input = el;
            break;
          }
        }

        if (!input) {
          input = document.querySelector(textareaSelectors);
        }

        if (!input) {
          const all = document.querySelectorAll('div[contenteditable="true"], textarea');
          for (const el of all) {
            if (el.offsetParent !== null) {
              input = el;
              break;
            }
          }
        }

        if (!input) {
          return { success: false, error: 'Could not find Grok input field' };
        }

        input.focus();
        await new Promise(r => setTimeout(r, 100));

        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
          const nativeSet = Object.getOwnPropertyDescriptor(
            input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            'value'
          );
          if (nativeSet && nativeSet.set) {
            nativeSet.set.call(input, promptText);
          } else {
            input.value = promptText;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          if (input.getAttribute('contenteditable')) {
            input.focus();
            input.innerText = '';
            input.dispatchEvent(new InputEvent('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 50));
            input.innerText = promptText;
            input.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
          } else {
            input.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, promptText);
          }
        }

        await new Promise(r => setTimeout(r, 100));

        const preCopyCount = __countCopy();
        const preReactionCount = __countReaction();
        const preFollowUpCount = __countFollowUp();

        return {
          success: true,
          inputTag: input.tagName,
          preCopyCount,
          preReactionCount,
          preFollowUpCount,
          preMessageCount: preCopyCount,
        };
      })()`);

      if (result.success) {
        await new Promise(r => setTimeout(r, 200));

        await wc.executeJavaScript(`(() => {
          const form = document.querySelector('form');
          if (form) {
            const sendBtns = form.querySelectorAll('div.ms-auto button');
            if (sendBtns.length > 0) {
              sendBtns[sendBtns.length - 1].click();
              return 'clicked-ms-auto';
            }
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
              submitBtn.click();
              return 'clicked-submit';
            }
            form.dispatchEvent(new Event('submit', { bubbles: true }));
            return 'form-submit';
          }
          const input = document.activeElement;
          if (input) {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            return 'enter-key';
          }
          return 'no-send';
        })()`);
      }

      console.log(`${LOG} grok-send-prompt: success=${result.success}, inputTag=${result.inputTag || 'n/a'}, baseline: copy=${result.preCopyCount}, reactions=${result.preReactionCount}, followUps=${result.preFollowUpCount}, error=${result.error || 'none'}`);
      return result;
    } catch (err) {
      console.error(`${LOG} grok-send-prompt error:`, err.message);
      return { success: false, error: err.message };
    }
  });

  console.log(`${LOG} Grok IPC handlers registered (${BROWSER_MODE_VERSION})`);
  return BROWSER_MODE_VERSION;
}

module.exports = { registerGrokIpcHandlers, findGrokWebviewContents, BROWSER_MODE_VERSION };
