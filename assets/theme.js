(() => {
  const theme = window.theme || { routes: {}, strings: {} };
  const root = theme.routes.root || '/';

  const debounce = (fn, wait = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  const fetchJSON = (url, body) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok || data.status) throw data;
      return data;
    });

  const toast = (() => {
    let el;
    let timer;
    return (message) => {
      if (!el) {
        el = document.createElement('div');
        el.className = 'toast';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
      }
      el.textContent = message;
      requestAnimationFrame(() => el.classList.add('is-visible'));
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('is-visible'), 3000);
    };
  })();

  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

  const trapFocus = (container, event) => {
    if (event.key !== 'Tab') return;
    const items = [...container.querySelectorAll(focusableSelector)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  class DrawerElement extends HTMLElement {
    connectedCallback() {
      this.panel = this.querySelector('.drawer__panel');
      this.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) this.close();
      });
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
        if (this.panel) trapFocus(this.panel, e);
      });
    }

    open(trigger) {
      this.trigger = trigger || document.activeElement;
      this.classList.add('is-open');
      document.body.classList.add('is-locked');
      if (this.trigger && this.trigger.setAttribute) this.trigger.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => this.panel && this.panel.focus());
    }

    close() {
      if (!this.classList.contains('is-open')) return;
      this.classList.remove('is-open');
      if (!document.querySelector('.drawer.is-open')) document.body.classList.remove('is-locked');
      if (this.trigger && this.trigger.setAttribute) {
        this.trigger.setAttribute('aria-expanded', 'false');
        this.trigger.focus();
      }
    }
  }

  customElements.define('menu-drawer', class extends DrawerElement {});

  class CartDrawer extends DrawerElement {
    renderContents(html) {
      const doc = parseHTML(html);
      const fresh = doc.querySelector('cart-drawer');
      if (!fresh) return;
      const wasOpen = this.classList.contains('is-open');
      this.innerHTML = fresh.innerHTML;
      this.panel = this.querySelector('.drawer__panel');
      this.dataset.count = fresh.dataset.count;
      if (wasOpen) this.panel.focus();
    }
  }
  customElements.define('cart-drawer', CartDrawer);

  const updateCartCount = (count) => {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.hidden = Number(count) === 0;
    });
  };

  const cartSections = () => {
    const ids = [];
    if (document.querySelector('cart-drawer')) ids.push('cart-drawer');
    const page = document.querySelector('cart-page');
    if (page) ids.push(page.dataset.sectionId);
    return ids;
  };

  const renderCartSections = (sections) => {
    if (!sections) return;
    const drawer = document.querySelector('cart-drawer');
    if (drawer && sections['cart-drawer']) {
      drawer.renderContents(sections['cart-drawer']);
      updateCartCount(drawer.dataset.count);
    }
    const page = document.querySelector('cart-page');
    if (page && sections[page.dataset.sectionId]) {
      const fresh = parseHTML(sections[page.dataset.sectionId]).querySelector('cart-page');
      if (fresh) page.innerHTML = fresh.innerHTML;
    }
  };

  const openCart = (trigger) => {
    const drawer = document.querySelector('cart-drawer');
    if (drawer) drawer.open(trigger);
  };

  const refreshCart = () => {
    const sections = cartSections();
    if (!sections.length) return Promise.resolve();
    return fetch(`${window.location.pathname}?sections=${sections.join(',')}`)
      .then((r) => r.json())
      .then(renderCartSections);
  };

  const changeLine = (line, quantity, itemEl) => {
    if (itemEl) itemEl.classList.add('is-loading');
    return fetchJSON(theme.routes.cartChange + '.js', { line, quantity, sections: cartSections(), sections_url: window.location.pathname })
      .then((cart) => {
        renderCartSections(cart.sections);
        updateCartCount(cart.item_count);
      })
      .catch((err) => {
        toast((err && (err.description || err.message)) || theme.strings.cartError);
        if (itemEl) itemEl.classList.remove('is-loading');
      });
  };

  document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-open-menu]');
    if (menuBtn) {
      e.preventDefault();
      document.querySelector('menu-drawer')?.open(menuBtn);
      return;
    }

    const cartBtn = e.target.closest('[data-open-cart]');
    if (cartBtn && theme.cartType === 'drawer' && document.querySelector('cart-drawer') && !document.body.classList.contains('template-cart')) {
      e.preventDefault();
      openCart(cartBtn);
      return;
    }

    const searchBtn = e.target.closest('[data-open-search]');
    if (searchBtn) {
      e.preventDefault();
      const modal = document.getElementById('SearchModal');
      if (modal) {
        modal.showModal();
        modal.querySelector('input[type="search"]')?.focus();
      }
      return;
    }

    const removeBtn = e.target.closest('[data-remove-line]');
    if (removeBtn) {
      e.preventDefault();
      changeLine(Number(removeBtn.dataset.removeLine), 0, removeBtn.closest('.cart-item'));
      return;
    }

    const dialogClose = e.target.closest('dialog [data-close]');
    if (dialogClose) {
      dialogClose.closest('dialog').close();
      return;
    }

    if (e.target.tagName === 'DIALOG' && e.target.classList.contains('modal')) {
      const rect = e.target.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) e.target.close();
    }
  });

  document.addEventListener('change', (e) => {
    const lineInput = e.target.closest('.cart-item input[data-line]');
    if (lineInput) {
      changeLine(Number(lineInput.dataset.line), Math.max(0, Number(lineInput.value)), lineInput.closest('.cart-item'));
      return;
    }
    if (e.target.matches('[data-autosubmit]')) {
      e.target.form.submit();
    }
  });

  document.addEventListener('submit', (e) => {
    const confirmForm = e.target.closest('form[data-confirm]');
    if (confirmForm && !window.confirm(confirmForm.dataset.confirm)) {
      e.preventDefault();
      return;
    }

    const form = e.target.closest('form[data-product-form]');
    if (!form) return;
    if (theme.cartType === 'page' && !document.querySelector('cart-drawer')) return;

    e.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const message = form.querySelector('.form-message');
    if (submit) {
      submit.classList.add('is-loading');
      submit.setAttribute('aria-busy', 'true');
    }
    if (message) message.hidden = true;

    const formData = new FormData(form);
    const sections = cartSections();
    formData.append('sections', sections.join(','));
    formData.append('sections_url', window.location.pathname);

    fetch(theme.routes.cartAdd + '.js', {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.status) throw data;
        return data;
      })
      .then((data) => {
        renderCartSections(data.sections);
        const quick = document.getElementById('QuickAddModal');
        if (quick && quick.open) quick.close();
        if (document.querySelector('cart-drawer')) {
          openCart(submit);
        } else {
          window.location.href = theme.routes.cart;
        }
      })
      .catch((err) => {
        const text = (err && (err.description || err.message)) || theme.strings.cartError;
        if (message) {
          message.textContent = text;
          message.hidden = false;
        } else {
          toast(text);
        }
      })
      .finally(() => {
        if (submit) {
          submit.classList.remove('is-loading');
          submit.removeAttribute('aria-busy');
        }
      });
  });

  customElements.define(
    'quantity-input',
    class extends HTMLElement {
      connectedCallback() {
        this.input = this.querySelector('input');
        this.addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const min = Number(this.input.min || 0);
          const current = Number(this.input.value) || 0;
          const next = btn.name === 'plus' ? current + 1 : Math.max(min, current - 1);
          if (next === current) return;
          this.input.value = next;
          this.input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }
  );

  customElements.define(
    'cart-note',
    class extends HTMLElement {
      connectedCallback() {
        const textarea = this.querySelector('textarea');
        textarea.addEventListener(
          'input',
          debounce(() => fetchJSON(theme.routes.cartUpdate + '.js', { note: textarea.value }).catch(() => {}), 500)
        );
      }
    }
  );

  customElements.define('cart-page', class extends HTMLElement {});

  customElements.define(
    'sticky-header',
    class extends HTMLElement {
      connectedCallback() {
        const setHeight = () => document.documentElement.style.setProperty('--header-height', `${this.offsetHeight}px`);
        setHeight();
        if ('ResizeObserver' in window) new ResizeObserver(setHeight).observe(this);
        const transparent = this.classList.contains('header-wrapper--transparent');
        if (this.dataset.sticky !== 'true' && !transparent) return;
        let last = 0;
        const onScroll = () => {
          const y = window.scrollY;
          this.classList.toggle('is-scrolled', y > 10);
          const menuOpen = this.querySelector('details[open]');
          if (this.dataset.hideOnScroll === 'true') {
            this.classList.toggle('is-hidden', y > last && y > 300 && !menuOpen);
          }
          last = y;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        if ('IntersectionObserver' in window) {
          const sentinel = document.createElement('div');
          sentinel.setAttribute('aria-hidden', 'true');
          sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:11px;pointer-events:none;visibility:hidden;';
          document.body.prepend(sentinel);
          new IntersectionObserver(([entry]) => {
            this.classList.toggle('is-scrolled', !entry.isIntersecting);
          }).observe(sentinel);
        }
      }
    }
  );

  customElements.define(
    'details-hover',
    class extends HTMLElement {
      connectedCallback() {
        this.details = this.querySelector('details');
        this.summary = this.querySelector('summary');
        const canHover = window.matchMedia('(hover: hover)').matches;
        if (canHover) {
          this.addEventListener('mouseenter', () => this.open());
          this.addEventListener('mouseleave', () => this.close());
        }
        this.details.addEventListener('toggle', () => {
          if (this.details.open) {
            document.querySelectorAll('details-hover details[open]').forEach((d) => {
              if (d !== this.details) d.open = false;
            });
          }
        });
        this.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.details.open) {
            this.close();
            this.summary.focus();
          }
        });
        this.addEventListener('focusout', (e) => {
          if (!this.contains(e.relatedTarget)) this.close();
        });
        document.addEventListener('click', (e) => {
          if (!this.contains(e.target)) this.close();
        });
      }

      open() {
        this.details.open = true;
      }

      close() {
        this.details.open = false;
      }
    }
  );

  customElements.define(
    'predictive-search',
    class extends HTMLElement {
      connectedCallback() {
        this.input = this.querySelector('input[type="search"]');
        this.results = this.querySelector('.predictive-results');
        if (this.dataset.enabled !== 'true') return;
        this.input.addEventListener(
          'input',
          debounce(() => this.search(), 250)
        );
      }

      search() {
        const q = this.input.value.trim();
        if (!q) {
          this.results.innerHTML = '';
          this.input.setAttribute('aria-expanded', 'false');
          return;
        }
        this.abort?.abort();
        this.abort = new AbortController();
        const params = new URLSearchParams({
          q,
          'resources[type]': 'product,collection,page,article,query',
          'resources[limit]': '6',
          'resources[options][fields]': 'title,product_type,variants.title,vendor,tag',
          section_id: 'predictive-search',
        });
        fetch(`${theme.routes.predictiveSearch}?${params}`, { signal: this.abort.signal })
          .then((r) => r.text())
          .then((html) => {
            const content = parseHTML(html).querySelector('#predictive-search-results');
            this.results.innerHTML = content ? content.outerHTML : '';
            this.input.setAttribute('aria-expanded', content ? 'true' : 'false');
          })
          .catch(() => {});
      }
    }
  );

  customElements.define(
    'announcement-slider',
    class extends HTMLElement {
      connectedCallback() {
        this.slides = [...this.querySelectorAll('.announcement__slide')];
        if (this.slides.length < 2 || this.dataset.autoplay !== 'true') return;
        this.index = 0;
        this.timer = setInterval(() => {
          this.slides[this.index].classList.remove('is-active');
          this.index = (this.index + 1) % this.slides.length;
          this.slides[this.index].classList.add('is-active');
        }, 4500);
      }

      disconnectedCallback() {
        clearInterval(this.timer);
      }
    }
  );

  class ScrollSlider extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-track]');
      this.prev = this.querySelector('[data-prev]');
      this.next = this.querySelector('[data-next]');
      if (!this.track) return;
      this.prev?.addEventListener('click', () => this.go(-1));
      this.next?.addEventListener('click', () => this.go(1));
      this.track.addEventListener('scroll', debounce(() => this.update(), 60), { passive: true });
      this.update();
    }

    get items() {
      return [...this.track.children];
    }

    get index() {
      const width = this.items[0]?.getBoundingClientRect().width || 1;
      return Math.round(this.track.scrollLeft / width);
    }

    go(dir) {
      const item = this.items[0];
      if (!item) return;
      const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      this.track.scrollBy({ left: dir * (item.getBoundingClientRect().width + gap), behavior: 'smooth' });
    }

    update() {
      const max = this.track.scrollWidth - this.track.clientWidth - 2;
      if (this.prev) this.prev.disabled = this.track.scrollLeft <= 2;
      if (this.next) this.next.disabled = this.track.scrollLeft >= max;
    }
  }
  customElements.define('slider-component', class extends ScrollSlider {});

  customElements.define(
    'slideshow-component',
    class extends ScrollSlider {
      connectedCallback() {
        super.connectedCallback();
        this.dots = [...this.querySelectorAll('[data-dot]')];
        this.dots.forEach((dot) =>
          dot.addEventListener('click', () => this.goTo(Number(dot.dataset.dot)))
        );
        if (this.dataset.autoplay === 'true' && this.items.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.startAutoplay();
          this.addEventListener('mouseenter', () => this.stopAutoplay());
          this.addEventListener('mouseleave', () => this.startAutoplay());
          this.addEventListener('focusin', () => this.stopAutoplay());
        }
      }

      disconnectedCallback() {
        this.stopAutoplay();
      }

      go(dir) {
        const count = this.items.length;
        this.goTo((this.index + dir + count) % count);
      }

      goTo(i) {
        this.track.scrollTo({ left: this.track.clientWidth * i, behavior: 'smooth' });
      }

      update() {
        const i = this.index;
        this.dots?.forEach((dot, n) => dot.classList.toggle('is-active', n === i));
      }

      startAutoplay() {
        this.stopAutoplay();
        this.timer = setInterval(() => this.go(1), Number(this.dataset.speed || 6) * 1000);
      }

      stopAutoplay() {
        clearInterval(this.timer);
      }
    }
  );

  customElements.define(
    'before-after',
    class extends HTMLElement {
      connectedCallback() {
        const range = this.querySelector('input[type="range"]');
        range.addEventListener('input', () => this.style.setProperty('--position', `${range.value}%`));
      }
    }
  );

  customElements.define(
    'countdown-timer',
    class extends HTMLElement {
      connectedCallback() {
        const end = Date.parse(`${this.dataset.end}${this.dataset.offset || ''}`);
        if (Number.isNaN(end)) return;
        this.end = end;
        this.els = {
          days: this.querySelector('[data-days]'),
          hours: this.querySelector('[data-hours]'),
          minutes: this.querySelector('[data-minutes]'),
          seconds: this.querySelector('[data-seconds]'),
        };
        this.tick();
        this.timer = setInterval(() => this.tick(), 1000);
      }

      disconnectedCallback() {
        clearInterval(this.timer);
      }

      tick() {
        const diff = this.end - Date.now();
        if (diff <= 0) {
          clearInterval(this.timer);
          this.querySelector('[data-running]').hidden = true;
          this.querySelector('[data-done]').hidden = false;
          return;
        }
        const pad = (n) => String(n).padStart(2, '0');
        this.els.days.textContent = pad(Math.floor(diff / 86400000));
        this.els.hours.textContent = pad(Math.floor((diff / 3600000) % 24));
        this.els.minutes.textContent = pad(Math.floor((diff / 60000) % 60));
        this.els.seconds.textContent = pad(Math.floor((diff / 1000) % 60));
      }
    }
  );

  customElements.define(
    'deferred-video',
    class extends HTMLElement {
      connectedCallback() {
        const poster = this.querySelector('.video__poster');
        const template = this.querySelector('template');
        if (!poster || !template) return;
        poster.addEventListener('click', () => {
          const content = template.content.cloneNode(true);
          poster.replaceWith(content);
          this.querySelector('video')?.play();
        });
      }
    }
  );

  customElements.define(
    'product-gallery',
    class extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-track]');
        this.thumbs = [...this.querySelectorAll('[data-thumb]')];
        this.dots = [...this.querySelectorAll('.gallery__dots .dot')];
        this.thumbs.forEach((thumb) =>
          thumb.addEventListener('click', () => this.show(thumb.dataset.thumb))
        );
        this.track.addEventListener(
          'scroll',
          debounce(() => {
            const i = Math.round(this.track.scrollLeft / (this.track.clientWidth || 1));
            this.setActive(i);
          }, 60),
          { passive: true }
        );
        const active = this.querySelector('.gallery__item.is-active');
        if (active && active !== this.track.firstElementChild) {
          this.show(active.dataset.mediaId, false);
        }
      }

      show(mediaId, smooth = true) {
        const items = [...this.track.children];
        const i = items.findIndex((el) => el.dataset.mediaId === String(mediaId));
        if (i < 0) return;
        if (getComputedStyle(this.track).display === 'grid') {
          items[i].scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' });
        } else {
          this.track.scrollTo({ left: items[i].offsetLeft - this.track.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
        }
        this.setActive(i);
      }

      setActive(i) {
        this.thumbs.forEach((t, n) => t.classList.toggle('is-active', n === i));
        this.dots.forEach((d, n) => d.classList.toggle('is-active', n === i));
      }
    }
  );

  customElements.define(
    'variant-picker',
    class extends HTMLElement {
      connectedCallback() {
        this.variants = JSON.parse(this.querySelector('[data-variants]').textContent);
        this.addEventListener('change', () => this.onChange());
      }

      selectedOptions() {
        const values = [];
        this.querySelectorAll('.variant-picker__option').forEach((group) => {
          const checked = group.querySelector('input:checked');
          const select = group.querySelector('select');
          values.push(checked ? checked.value : select ? select.value : null);
        });
        return values;
      }

      onChange() {
        const options = this.selectedOptions();
        const variant = this.variants.find((v) => v.options.every((opt, i) => opt === options[i]));
        const container = this.parentElement.closest('.main-product, .quick-add') || document;
        const sectionId = this.dataset.sectionId;
        const idInput = container.querySelector('[data-variant-id]');
        const submit = container.querySelector('.product-form__submit');

        if (!variant) {
          if (submit) {
            submit.disabled = true;
            submit.querySelector('span').textContent = theme.strings.unavailable;
          }
          return;
        }

        if (idInput) {
          idInput.value = variant.id;
          idInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const isMainProduct = !this.closest('.quick-add');
        if (isMainProduct) {
          const url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          window.history.replaceState({}, '', url.toString());
        }

        if (variant.featured_media) {
          container.querySelector('product-gallery')?.show(variant.featured_media.id);
          const quickImg = container.querySelector('.quick-add__media img');
          if (quickImg && variant.featured_media.preview_image) {
            quickImg.srcset = '';
            quickImg.src = variant.featured_media.preview_image.src;
          }
        }

        this.abort?.abort();
        this.abort = new AbortController();
        fetch(`${this.dataset.url}?variant=${variant.id}&section_id=${sectionId}`, { signal: this.abort.signal })
          .then((r) => r.text())
          .then((html) => {
            const doc = parseHTML(html);
            container.querySelectorAll('[data-dynamic][id]').forEach((el) => {
              const fresh = doc.getElementById(el.id);
              if (!fresh) return;
              if (el.contains(this)) {
                const freshPicker = fresh.querySelector('variant-picker');
                if (freshPicker) {
                  this.querySelectorAll('.variant-picker__selected').forEach((label, i) => {
                    const src = freshPicker.querySelectorAll('.variant-picker__selected')[i];
                    if (src) label.textContent = src.textContent;
                  });
                  const freshLabels = freshPicker.querySelectorAll('.pill, .swatch-pill');
                  this.querySelectorAll('.pill, .swatch-pill').forEach((label, i) => {
                    if (freshLabels[i]) label.className = freshLabels[i].className;
                  });
                }
                return;
              }
              if (el.tagName === 'BUTTON') {
                el.disabled = fresh.disabled;
                el.innerHTML = fresh.innerHTML;
              } else {
                el.innerHTML = fresh.innerHTML;
              }
            });
          })
          .catch(() => {});
      }
    }
  );

  customElements.define(
    'quick-add-button',
    class extends HTMLElement {
      connectedCallback() {
        this.querySelector('button').addEventListener('click', () => this.open());
      }

      open() {
        const modal = document.getElementById('QuickAddModal');
        if (!modal) {
          window.location.href = this.dataset.url;
          return;
        }
        const content = modal.querySelector('[data-quick-add-content]');
        content.innerHTML = '';
        modal.showModal();
        fetch(`${this.dataset.url}?section_id=quick-add`)
          .then((r) => r.text())
          .then((html) => {
            const section = parseHTML(html).querySelector('.quick-add');
            if (!section) {
              window.location.href = this.dataset.url;
              return;
            }
            content.innerHTML = '';
            content.appendChild(section);
            const script = content.querySelector('script[type="application/json"]');
            if (script) script.textContent = script.textContent;
            content.querySelectorAll('.shopify-payment-button').forEach((el) => el.remove());
          })
          .catch(() => {
            window.location.href = this.dataset.url;
          });
      }
    }
  );

  customElements.define(
    'sticky-atc',
    class extends HTMLElement {
      connectedCallback() {
        const form = document.getElementById(this.dataset.form);
        const submit = form?.querySelector('.product-form__submit');
        if (!form || !submit) return;
        this.hidden = false;
        this.querySelector('[data-sticky-submit]').addEventListener('click', () => {
          if (submit.disabled) {
            submit.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
          form.requestSubmit(submit);
        });
        new IntersectionObserver(([entry]) => {
          this.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
        }).observe(submit);
      }
    }
  );

  customElements.define(
    'product-recommendations',
    class extends HTMLElement {
      connectedCallback() {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            fetch(this.dataset.url)
              .then((r) => r.text())
              .then((html) => {
                const fresh = parseHTML(html).querySelector('product-recommendations');
                if (fresh && fresh.innerHTML.trim()) {
                  this.innerHTML = fresh.innerHTML;
                } else {
                  this.hidden = true;
                }
              })
              .catch(() => {});
          },
          { rootMargin: '0px 0px 400px 0px' }
        );
        observer.observe(this);
      }
    }
  );

  customElements.define(
    'facet-filters',
    class extends HTMLElement {
      connectedCallback() {
        this.sectionId = this.dataset.sectionId;
        this.form = this.querySelector('form');
        this.drawer = this.querySelector('[data-filters-drawer]');
        this.form.addEventListener('change', () => this.submit());
        this.form.addEventListener('input', debounce((e) => {
          if (e.target.type === 'number') this.submit();
        }, 700));
        this.form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submit();
        });
        this.addEventListener('click', (e) => {
          if (e.target.closest('[data-open-filters]')) this.openDrawer();
          if (e.target.closest('[data-filters-drawer] [data-close]')) this.closeDrawer();
        });
        this.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') this.closeDrawer();
        });
      }

      openDrawer() {
        this.drawer?.classList.add('is-open');
        document.body.classList.add('is-locked');
        this.drawer?.querySelector('.drawer__panel').focus();
      }

      closeDrawer() {
        this.drawer?.classList.remove('is-open');
        document.body.classList.remove('is-locked');
      }

      submit() {
        const params = new URLSearchParams();
        new FormData(this.form).forEach((value, key) => {
          if (value !== '') params.append(key, value);
        });
        loadResults(`${window.location.pathname}?${params.toString()}`, this.sectionId, this.drawer?.classList.contains('is-open'));
      }
    }
  );

  const loadResults = (url, sectionId, keepDrawerOpen) => {
    const section = document.getElementById(`ResultsSection-${sectionId}`);
    if (!section) {
      window.location.href = url;
      return;
    }
    section.querySelector('.results')?.classList.add('is-loading');
    const fetchUrl = new URL(url, window.location.origin);
    fetchUrl.searchParams.set('section_id', sectionId);
    fetch(fetchUrl)
      .then((r) => r.text())
      .then((html) => {
        const fresh = parseHTML(html).getElementById(`ResultsSection-${sectionId}`);
        if (!fresh) return;
        const openGroups = [...section.querySelectorAll('.facets__group')].map((d) => d.open);
        section.innerHTML = fresh.innerHTML;
        section.querySelectorAll('.facets__group').forEach((d, i) => {
          if (openGroups[i] !== undefined) d.open = openGroups[i];
        });
        if (keepDrawerOpen) {
          section.querySelector('[data-filters-drawer]')?.classList.add('is-open');
        } else {
          document.body.classList.remove('is-locked');
        }
        const clean = new URL(url, window.location.origin);
        clean.searchParams.delete('section_id');
        window.history.pushState({ results: sectionId }, '', clean.pathname + clean.search);
        revealAll(section);
      })
      .catch(() => {
        window.location.href = url;
      });
  };

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-facet-link]');
    if (!link) return;
    const section = link.closest('[id^="ResultsSection-"]');
    if (!section) return;
    e.preventDefault();
    const sectionId = section.id.replace('ResultsSection-', '');
    const inDrawer = !!link.closest('[data-filters-drawer]');
    loadResults(link.getAttribute('href'), sectionId, inDrawer);
    if (link.closest('.pagination')) section.scrollIntoView({ behavior: 'smooth' });
  });

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.results) window.location.reload();
  });

  customElements.define(
    'share-button',
    class extends HTMLElement {
      connectedCallback() {
        this.querySelector('button').addEventListener('click', async () => {
          const data = { url: this.dataset.url, title: this.dataset.title };
          if (navigator.share) {
            try {
              await navigator.share(data);
            } catch (err) {}
            return;
          }
          try {
            await navigator.clipboard.writeText(data.url);
            toast('Link copiado!');
          } catch (err) {}
        });
      }
    }
  );

  customElements.define(
    'promo-popup',
    class extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('dialog');
        const key = `popup-${this.dataset.id}`;
        const inEditor = this.dataset.test === 'true';
        if (inEditor) return;
        let last = 0;
        try {
          last = Number(localStorage.getItem(key) || 0);
        } catch (err) {}
        const days = Number(this.dataset.days || 7);
        if (Date.now() - last < days * 86400000) return;
        const hasSuccess = this.querySelector('.form-message--success, .form-message--error');
        if (hasSuccess) {
          this.dialog.showModal();
          return;
        }
        setTimeout(() => {
          if (document.querySelector('dialog[open]')) return;
          this.dialog.showModal();
          try {
            localStorage.setItem(key, String(Date.now()));
          } catch (err) {}
        }, Number(this.dataset.delay || 5) * 1000);
      }
    }
  );

  document.addEventListener('shopify:section:select', (e) => {
    const popup = e.target.querySelector('promo-popup dialog');
    if (popup && !popup.open) popup.showModal();
  });

  document.addEventListener('shopify:section:deselect', (e) => {
    const popup = e.target.querySelector('promo-popup dialog');
    if (popup && popup.open) popup.close();
  });

  document.addEventListener('shopify:block:select', (e) => {
    const slideshow = e.target.closest('slideshow-component');
    if (slideshow) {
      slideshow.stopAutoplay();
      const index = [...slideshow.querySelectorAll('[data-slide]')].indexOf(e.target);
      if (index >= 0) slideshow.goTo(index);
    }
    const details = e.target.closest('details');
    if (details) details.open = true;
  });

  let revealObserver;
  const revealAll = (scope = document) => {
    if (!document.body.classList.contains('animations-enabled')) return;
    if (!('IntersectionObserver' in window)) {
      scope.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-revealed'));
      return;
    }
    revealObserver =
      revealObserver ||
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-revealed');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px' }
      );
    scope.querySelectorAll('.reveal:not(.is-revealed)').forEach((el) => revealObserver.observe(el));
  };

  const initAddressSelects = () => {
    document.querySelectorAll('select[data-default]').forEach((select) => {
      if (select.dataset.default) select.value = select.dataset.default;
    });
  };

  document.addEventListener('shopify:section:load', (e) => revealAll(e.target));

  const init = () => {
    revealAll();
    initAddressSelects();
    if (window.Shopify && window.Shopify.designMode) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-revealed'));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.theme.refreshCart = refreshCart;
  window.theme.root = root;
})();
