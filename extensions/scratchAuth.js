(function (Scratch) {
  'use strict';

  const SESSION_URL = 'https://scratch.mit.edu/session/';
  const LOGIN_URL = 'https://scratch.mit.edu/login/';
  const PROFILE_URL = 'https://scratch.mit.edu/users/';
  const COMMENTS_URL = 'https://api.scratch.mit.edu/users/';

  class ScratchAuth {
    constructor() {
      this._username = '';
      this._status = 'not logged in';
    }

    getInfo() {
      return {
        id: 'scratchAuth',
        name: 'Scratch Auth',
        color1: '#ffab19',
        color2: '#ec9c13',
        blocks: [
          {
            opcode: 'login',
            blockType: Scratch.BlockType.COMMAND,
            text: 'log in with Scratch'
          },
          {
            opcode: 'username',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Scratch username'
          },
          {
            opcode: 'isLoggedIn',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'logged in with Scratch?'
          },
          {
            opcode: 'status',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Scratch login status'
          },
          {
            opcode: 'clear',
            blockType: Scratch.BlockType.COMMAND,
            text: 'clear Scratch login'
          }
        ]
      };
    }

    async login() {
      const existingUser = await this._sessionUsername();
      if (existingUser) {
        this._setUser(existingUser);
        return;
      }

      this._status = 'waiting for Scratch login';
      let popup = null;
      try {
        popup = window.open(LOGIN_URL, 'scratchLogin', 'popup,width=720,height=720');
      } catch (error) {
        popup = null;
      }

      const username = await this._waitForSession(90, popup);
      if (username) {
        this._setUser(username);
      } else {
        await this._verifyByProfileComment();
      }
    }

    username() {
      return this._username;
    }

    async isLoggedIn() {
      const username = await this._sessionUsername();
      if (username) this._setUser(username);
      return Boolean(this._username);
    }

    status() {
      return this._status;
    }

    clear() {
      this._username = '';
      this._status = 'not logged in';
    }

    _setUser(username) {
      this._username = username;
      this._status = `logged in as ${username}`;
    }

    async _waitForSession(seconds, popup) {
      for (let i = 0; i < seconds; i++) {
        const username = await this._sessionUsername();
        if (username) {
          if (popup && !popup.closed) popup.close();
          return username;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return '';
    }

    async _verifyByProfileComment() {
      const username = this._cleanUsername(prompt('Scratch username:'));
      if (!username) {
        this._status = 'Scratch login cancelled';
        return;
      }

      const code = `plega-${Math.random().toString(36).slice(2, 8)}`;
      this._status = `waiting for ${username} verification`;
      alert(`To log in as ${username}, post this exact code as a comment on your Scratch profile:\n\n${code}\n\nThen return here and wait.`);

      try {
        window.open(`${PROFILE_URL}${encodeURIComponent(username)}/#comments`, 'scratchProfileVerify', 'popup,width=900,height=720');
      } catch (error) {
        // Popups may be blocked; the status reporter still shows what to do.
      }

      const verified = await this._waitForProfileCode(username, code, 120);
      if (verified) {
        this._setUser(username);
      } else {
        this._status = 'Scratch profile code not found';
      }
    }

    async _waitForProfileCode(username, code, seconds) {
      for (let i = 0; i < seconds; i += 5) {
        if (await this._profileHasCode(username, code)) return true;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      return false;
    }

    async _profileHasCode(username, code) {
      try {
        const response = await fetch(`${COMMENTS_URL}${encodeURIComponent(username)}/comments?limit=40&offset=0`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) return false;
        const comments = await response.json();
        if (!Array.isArray(comments)) return false;
        return comments.some(comment => {
          const author = comment && comment.author && comment.author.username;
          const content = comment && comment.content;
          return author === username && typeof content === 'string' && content.includes(code);
        });
      } catch (error) {
        return false;
      }
    }

    _cleanUsername(username) {
      const value = String(username || '').trim();
      return /^[A-Za-z0-9_-]{3,20}$/.test(value) ? value : '';
    }

    async _sessionUsername() {
      try {
        const response = await fetch(SESSION_URL, {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        if (!response.ok) return '';
        const data = await response.json();
        const username = data && data.user && data.user.username;
        return typeof username === 'string' ? username : '';
      } catch (error) {
        this._status = 'Scratch session blocked by browser';
        return '';
      }
    }
  }

  Scratch.extensions.register(new ScratchAuth());
})(Scratch);
