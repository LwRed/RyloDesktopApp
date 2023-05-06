const m = require('mithril');

let signin = {
  email: '',
  password: ''
}

function validate() {
  return signin.password.length >= 5 && signin.email.length >= 3 && signin.email.includes('@')
}

module.exports = {
  view() {
    return m('form.signin', {
      onsubmit(e) {
        e.preventDefault();
        return User.signIn(signin).then(_ => { signin.password = ''; });
      }
    }, [
      m('input[type=email]', {
        placeholder: 'Email',
        value: signin.email,
        oninput: m.withAttr('value', value => { signin.email = value; }),
        oncreate(vnode) { vnode.dom.focus(); }
      }),
      m('input[type=password]', {
        placeholder: 'Password',
        value: signin.password,
        oninput: m.withAttr('value', value => { signin.password = value; })
      }),
      m('input[type=submit]', { disabled: !validate(), value: 'Sign In'})
    ]);
  }
}
