const m = require('mithril');
const {ipcRenderer} = require('electron');
const {session} = require('electron').remote;

const daysToExpire = 31;

ipcRenderer.on('menu-signout', e => {
  User.signOut();
});

function hasSubscription(user) {
  return user && user.subscription === 'x';
}

function loadUser() {
  try {
    const data = JSON.parse(window.localStorage.getItem('user'));

    const lastRefresh = new Date(data.lastRefresh);
    const now = new Date();
    const msInDays = 1000 * 60 * 60 * 60 * 24;
    
    if ((now - lastRefresh) < msInDays * daysToExpire && hasSubscription(data.user)) {
      refreshUser();
      return data.user;
    }
  } catch (e) {
    // fall through
  }
  return null;
}

function saveUser(user) {
  window.localStorage.setItem('user', JSON.stringify({
    user: user,
    lastRefresh: new Date()
  }));
}

function refreshUser() {
  m.request({
    method: 'GET',
    url: 'https://services.rylo.com/api/v1/u/info',
  })
  .then(user => { saveUser(user); });
}

module.exports = {
  user: loadUser(),

  signIn(signin) {
    return m.request({
      method: 'POST',
      url: 'https://services.rylo.com/api/v1/p/signin',
      data: signin
    })
    .then(result => {
      this.saveUser(result);
      if (this.hasSubscription()) {
        m.route.set('/app');
      }
    })
    .catch(error => {
      alert('Incorrect credentials. Please try again.');
    });
  },

  signOut() {
    window.localStorage.removeItem('user');
    session.defaultSession.clearStorageData({storages: ['cookies']});
    m.route.set('/signin');
  },

  hasSubscription() {
    return hasSubscription(this.user);
  },

  saveUser(user) {
    this.user = user;
    saveUser(user);
  }
}
