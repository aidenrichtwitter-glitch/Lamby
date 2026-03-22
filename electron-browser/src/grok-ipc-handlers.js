const { ipcMain, webContents } = require('electron');

const BROWSER_MODE_VERSION = 'v26.2';

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
  stop: [
    'button[aria-label="Stop"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop model response"]',
    'button[aria-label="Stop response"]',
    'button[data-testid="stop-button"]',
    'button[data-testid="stop-generating"]',
  ],
  copy: [
    'div.action-buttons.last-response button:nth-child(4)',
    'div.action-buttons button:nth-child(4)',
    'button[aria-label="Copy"]',
    'button[aria-label="Copy to clipboard"]',
    'button[aria-label="Copy response"]',
    'button[data-testid="copy-button"]',
  ],
  reaction: [
    'button[aria-label="Good response"]',
    'button[aria-label="Bad response"]',
    'button[aria-label="Like"]',
    'button[aria-label="Dislike"]',
    'button[aria-label="Thumbs up"]',
    'button[aria-label="Thumbs down"]',
    'button[data-testid="like-button"]',
    'button[data-testid="dislike-button"]',
    'button[data-testid="thumbUp"]',
    'button[data-testid="thumbDown"]',
  ],
  followUp: [
    'button[data-testid="suggested-prompt"]',
    'button[data-testid="follow-up"]',
    '[data-testid="suggestion-pill"]',
    '[data-testid="followup-suggestion"]',
  ],
  textarea: [
    'textarea[data-testid="chat-input"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="ask"]',
    'textarea[aria-label*="Ask"]',
    'textarea[data-testid="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-testid="chat-input"]',
  ],
  sendButton: [
    'button[aria-label="Send"]',
    'button[aria-label="Send message"]',
    'button[data-testid="send-button"]',
    'button[type="submit"]',
  ],
  response: [
    '[data-testid="message-text"]',
    '[data-testid="assistant-message"]',
    '[data-testid="bot-message"]',
    'div[data-message-author-role="assistant"]',
    'div[class*="message"][class*="assistant"]',
    'div[class*="response"]',
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
    if (__count(__stopSel) > 0) return true;
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (text === 'stop' || text === 'stop generating' || label.includes('stop')) return true;
    }
    return false;
  }

  function __countCopy() {
    const actionBars = document.querySelectorAll('div.action-buttons');
    if (actionBars.length > 0) return actionBars.length;
    let n = __count(__copySel);
    if (n > 0) return n;
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('copy') || label.includes('clipboard')) n++;
    }
    return n;
  }

  function __countReaction() {
    let n = __count(__reactionSel);
    if (n > 0) return n;
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('like') || label.includes('dislike') || label.includes('good') || label.includes('bad') || label.includes('thumb')) n++;
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
        const responseSelectors = ${JSON.stringify(responseSel)};
        let messages = document.querySelectorAll(responseSelectors);

        if (messages.length === 0) {
          const allDivs = document.querySelectorAll('div');
          const candidates = [];
          for (const div of allDivs) {
            const cl = (div.className || '').toLowerCase();
            const role = (div.getAttribute('data-message-author-role') || '').toLowerCase();
            const testId = (div.getAttribute('data-testid') || '').toLowerCase();
            if (role === 'assistant' || testId.includes('message') || testId.includes('response') || cl.includes('message') || cl.includes('response')) {
              if (div.innerText && div.innerText.trim().length > 20) {
                candidates.push(div);
              }
            }
          }
          messages = candidates;
        }

        if (messages.length === 0) {
          const turnContainers = document.querySelectorAll('[class*="turn"], [class*="Turn"], [data-testid*="turn"], [data-testid*="conversation"]');
          if (turnContainers.length > 0) {
            const last = turnContainers[turnContainers.length - 1];
            const text = last.innerText || '';
            if (text.trim().length > 10) {
              return { success: true, text: text.trim(), findMethod: 'turn-container' };
            }
          }
        }

        if (messages.length === 0) {
          return { success: false, error: 'No response messages found in DOM' };
        }

        const last = messages[messages.length - 1];
        const text = (last.innerText || last.textContent || '').trim();
        if (!text || text.length < 5) {
          return { success: false, error: 'Last response is empty or too short' };
        }
        return { success: true, text, findMethod: 'dom-scrape-fallback' };
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
        const responseSelectors = ${JSON.stringify(buildSelectorChain(SELECTORS.response))};
        let messages = document.querySelectorAll(responseSelectors);

        if (messages.length === 0) {
          const allDivs = document.querySelectorAll('div');
          const candidates = [];
          for (const div of allDivs) {
            const role = (div.getAttribute('data-message-author-role') || '').toLowerCase();
            const testId = (div.getAttribute('data-testid') || '').toLowerCase();
            const cl = (div.className || '').toLowerCase();
            if (role === 'assistant' || testId.includes('message') || testId.includes('response') || cl.includes('message') || cl.includes('response')) {
              if (div.innerText && div.innerText.trim().length > 20) {
                candidates.push(div);
              }
            }
          }
          messages = candidates;
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

      const result = await wc.executeJavaScript(`(() => {
        ${SHARED_COUNTING_JS}
        const promptText = ${escapedPrompt};
        const textareaSelectors = ${JSON.stringify(buildSelectorChain(SELECTORS.textarea))};
        const sendSelectors = ${JSON.stringify(buildSelectorChain(SELECTORS.sendButton))};

        let textarea = document.querySelector(textareaSelectors);

        if (!textarea) {
          const all = document.querySelectorAll('textarea, div[contenteditable="true"]');
          for (const el of all) {
            if (el.offsetParent !== null) {
              textarea = el;
              break;
            }
          }
        }

        if (!textarea) {
          return { success: false, error: 'Could not find Grok input field' };
        }

        const nativeSet = Object.getOwnPropertyDescriptor(
          textarea.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLElement.prototype,
          'value'
        );

        if (textarea.tagName === 'TEXTAREA') {
          if (nativeSet && nativeSet.set) {
            nativeSet.set.call(textarea, '');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            nativeSet.set.call(textarea, promptText);
          } else {
            textarea.value = promptText;
          }
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          textarea.innerText = promptText;
          textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
        }

        const preCopyCount = __countCopy();
        const preReactionCount = __countReaction();
        const preFollowUpCount = __countFollowUp();

        setTimeout(() => {
          let sendBtn = document.querySelector(sendSelectors);
          if (!sendBtn) {
            const allBtns = document.querySelectorAll('button');
            for (const btn of allBtns) {
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const text = (btn.textContent || '').trim().toLowerCase();
              if (label.includes('send') || text === 'send' || label.includes('submit')) {
                sendBtn = btn;
                break;
              }
            }
          }
          if (!sendBtn) {
            const form = textarea.closest('form');
            if (form) {
              form.dispatchEvent(new Event('submit', { bubbles: true }));
              return;
            }
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            return;
          }
          sendBtn.click();
        }, 200);

        return {
          success: true,
          preCopyCount,
          preReactionCount,
          preFollowUpCount,
          preMessageCount: preCopyCount,
        };
      })()`);

      console.log(`${LOG} grok-send-prompt: success=${result.success}, baseline: copy=${result.preCopyCount}, reactions=${result.preReactionCount}, followUps=${result.preFollowUpCount}, error=${result.error || 'none'}`);
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
