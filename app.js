document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  deobfuscateEmails();
  
  // Page-specific initializations
  if (document.getElementById('product-catalog')) {
    initProductCatalog();
  }
  if (document.getElementById('blogger-news')) {
    loadBloggerNews();
  }
  if (document.getElementById('inquiry-form')) {
    initInquiryForm();
  }
  if (document.querySelector('.pipeline-container')) {
    initPipelineAnimations();
  }
});

/* ==========================================================================
   1. Mobile Navigation & Scroll Effects
   ========================================================================== */
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const header = document.querySelector('.header');
  
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });

    // Close menu when a link is clicked
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });
  }

  // Header scroll effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });
}

/* ==========================================================================
   2. Email De-obfuscation (Spam bot protection)
   ========================================================================== */
// Obfuscated representation: 'aW5mb0B6YnAtdGVjLmNu' which is 'info@zbp-tec.cn'
const OBFUSCATED_EMAIL = 'aW5mb0B6YnAtdGVjLmNu';

function deobfuscateEmails() {
  const decoded = atob(OBFUSCATED_EMAIL);
  
  // Find all elements with data-email placeholder
  document.querySelectorAll('[data-email-decode]').forEach(el => {
    if (el.tagName === 'A') {
      el.href = `mailto:${decoded}`;
    }
    
    // Check if we should insert the text
    if (el.dataset.emailDecode === 'text') {
      el.textContent = decoded;
    }
  });
}

/* ==========================================================================
   3. Google Sheets Integration & Catalog Logic (CAS Only)
   ========================================================================== */
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1sSMc7rmIx4xfWAFMpHZvSMM3_wB-xprPkBqVUnwSH1g/export?format=csv';

let allProducts = [];

async function initProductCatalog() {
  const loading = document.getElementById('catalog-loading');
  const searchInput = document.getElementById('product-search');
  
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch sheet data');
    
    const csvText = await response.text();
    allProducts = parseCSV(csvText);
    
    // Hide loading
    if (loading) loading.style.display = 'none';
    
    // Initial Render
    renderProducts(allProducts);
    
    // Dynamic Schema.org injection for Google SEO
    injectProductsSchema(allProducts);
    
    // Event listener for CAS search only
    searchInput?.addEventListener('input', filterProducts);
    
  } catch (error) {
    console.error('Error fetching/parsing Google Sheets:', error);
    if (loading) {
      loading.innerHTML = `<div class="error-message">
        <h4>数据加载失败 / Loading Failed</h4>
        <p>无法从目录源动态读取数据，请刷新重试或直接联系我们询价。</p>
        <a href="mailto:${atob(OBFUSCATED_EMAIL)}" class="btn btn-primary" style="margin-top: 15px;">直接发送询盘</a>
      </div>`;
    }
  }
}

// Resilient CSV parser that handles quotes and commas inside columns
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') { i++; }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  
  if (lines.length < 2) return [];
  
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const getIndex = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
  
  const idx = {
    name: getIndex(['name', '名称', '产品名', 'title']),
    cas: getIndex(['cas', 'cas号']),
    purity: getIndex(['purity', '纯度', 'spec']),
    category: getIndex(['category', '类别', '分类', 'type']),
    certs: getIndex(['cert', '认证', 'compliance', 'standards']),
    mw: getIndex(['mw', 'molecular weight', '分子量', 'm.w.']),
    formula: getIndex(['formula', 'molecular formula', '分子式'])
  };
  
  return lines.slice(1).map(row => {
    const getValue = (fieldIndex, fallbackIdx) => {
      const realIdx = fieldIndex !== -1 ? fieldIndex : fallbackIdx;
      return row[realIdx] ? row[realIdx].trim() : '';
    };
    
    return {
      name: getValue(idx.name, 0),
      cas: getValue(idx.cas, 1),
      purity: getValue(idx.purity, 2),
      category: getValue(idx.category, 3),
      certs: getValue(idx.certs, 4),
      mw: getValue(idx.mw, 5),
      formula: getValue(idx.formula, 6)
    };
  }).filter(p => p.name && p.name !== '');
}

function renderProducts(products) {
  const container = document.getElementById('products-tbody');
  if (!container) return;
  
  if (products.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">未找到匹配的产品 / No matching products found.</td></tr>`;
    return;
  }
  
  container.innerHTML = products.map((p, idx) => {
    const certsHtml = p.certs ? p.certs.split(/[,，;；]/).map(c => {
      const cTrim = c.trim();
      if (!cTrim) return '';
      const isGMP = ['GMP', 'cGMP'].includes(cTrim.toUpperCase());
      return `<span class="cert-pill ${isGMP ? 'gmp' : ''}">${cTrim}</span>`;
    }).join('') : '<span style="color:var(--text-muted); font-size:0.85rem;">Standard</span>';
    
    const waText = encodeURIComponent(`Hi Lentotech, I am interested in Product: ${p.name} (CAS: ${p.cas || 'N/A'}, Purity: ${p.purity || 'N/A'}). Please provide a quote.`);
    
    return `
      <tr>
        <td>
          <strong style="color:#fff; font-size: 1.05rem; display: block; line-height: 1.3;">${p.name}</strong>
          ${p.formula ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Formula: ${p.formula}</div>` : ''}
        </td>
        <td>
          ${p.cas ? `<span class="cas-badge">${p.cas}</span>` : '<span style="color:var(--text-muted);">-</span>'}
        </td>
        <td>
          ${p.category ? `<span style="font-size:0.9rem; color:var(--text-muted);">${p.category}</span>` : '-'}
        </td>
        <td>
          <span class="purity-badge">${p.purity || '98%+'}</span>
        </td>
        <td>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">${certsHtml}</div>
        </td>
        <td style="text-align: right;">
          <a href="https://wa.me/message/D2ij4kMatiy4s5UUDO7pHd?text=${waText}" target="_blank" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.85rem; border-radius: 6px;">
            Inquire
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

function filterProducts() {
  const searchVal = document.getElementById('product-search').value.trim().toLowerCase();
  
  const filtered = allProducts.filter(p => {
    // Only match against the CAS number field
    return p.cas && p.cas.toLowerCase().includes(searchVal);
  });
  
  renderProducts(filtered);
}

// Injects Schema.org Product markup dynamically into Head for Google SEO indexing
function injectProductsSchema(products) {
  const items = products.slice(0, 10).map(p => ({
    "@type": "Product",
    "name": p.name,
    "category": p.category || "Chemical Ingredients",
    "mpn": p.cas || undefined,
    "description": `${p.name} (CAS ${p.cas || 'N/A'}). Purity: ${p.purity || 'N/A'}. Intended for research and export only.`,
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "itemCondition": "https://schema.org/NewCondition"
    }
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": item
    }))
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.innerHTML = JSON.stringify(schema);
  document.head.appendChild(script);
}

/* ==========================================================================
   4. Blogger RSS Feed & Carousel Mechanics
   ========================================================================== */
const BLOGGER_RSS_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=https://zbpgroup.blogspot.com/feeds/posts/default';

let currentCarouselIndex = 0;
let carouselAutoplay;

async function loadBloggerNews() {
  const container = document.getElementById('blogger-news');
  if (!container) return;
  
  try {
    const res = await fetch(BLOGGER_RSS_PROXY);
    if (!res.ok) throw new Error('Network error loading RSS');
    
    const data = await res.json();
    if (data.status !== 'ok' || !data.items || data.items.length === 0) {
      throw new Error('RSS conversion failed');
    }
    
    // Render top 6 blog articles as carousel slides
    const posts = data.items.slice(0, 6);
    container.innerHTML = posts.map(post => {
      const thumb = post.thumbnail || 'https://images.unsplash.com/photo-1576086213369-97a306d36557?q=80&w=400&auto=format&fit=crop';
      const date = new Date(post.pubDate).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      const preview = post.description.replace(/<[^>]*>/g, '').substring(0, 100) + '...';
      
      return `
        <article class="news-card carousel-slide">
          <img src="${thumb}" alt="${post.title}" class="news-img" loading="lazy">
          <div class="news-content">
            <span class="news-date">${date}</span>
            <h3 style="color:#fff; font-size:1.15rem; margin-bottom:10px;">${post.title}</h3>
            <p>${preview}</p>
            <a href="${post.link}" target="_blank" class="card-link">
              Read Article 
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </a>
          </div>
        </article>
      `;
    }).join('');
    
    initBlogCarousel();
    
  } catch (error) {
    console.warn('Could not load RSS Blogger feed, loading static fallback cards.', error);
    renderFallbackNews();
  }
}

function renderFallbackNews() {
  const container = document.getElementById('blogger-news');
  if (!container) return;
  
  const fallbackArticles = [
    {
      title: "Regulatory Compliance in Pharmaceutical CDMO Partnerships",
      date: "May 10, 2026",
      desc: "An in-depth analysis of FDA, cGMP, and ISO certification requirements during custom synthesis collaboration.",
      url: "https://zbpgroup.blogspot.com"
    },
    {
      title: "Sourcing Cosmetic Raw Ingredients: Safety & Sustainability Trends",
      date: "Apr 28, 2026",
      desc: "How global cosmetic brands are adopting strict criteria for raw material efficacy, biocompatibility, and certificates.",
      url: "https://zbpgroup.blogspot.com"
    },
    {
      title: "Optimizing Licensing-in and Licensing-out Pipelines",
      date: "Mar 15, 2026",
      desc: "Key frameworks for medical IP valuation, technical transfer processes, and signing confidential NDAs.",
      url: "https://zbpgroup.blogspot.com"
    },
    {
      title: "High-Purity Active Ingredients in Modern Drug Formulation",
      date: "Feb 22, 2026",
      desc: "A technical walkthrough on crystallization techniques, impurities control, and bioequivalence scaling.",
      url: "https://zbpgroup.blogspot.com"
    },
    {
      title: "Navigating Medical Device Customs and Logistics Hazards",
      date: "Jan 30, 2026",
      desc: "Addressing custom declarations, cold-chain monitoring, and biological material shipping compliance.",
      url: "https://zbpgroup.blogspot.com"
    }
  ];
  
  container.innerHTML = fallbackArticles.map(art => `
    <article class="news-card carousel-slide">
      <img src="https://images.unsplash.com/photo-1576086213369-97a306d36557?q=80&w=400&auto=format&fit=crop" alt="${art.title}" class="news-img" loading="lazy">
      <div class="news-content">
        <span class="news-date">${art.date}</span>
        <h3 style="color:#fff; font-size:1.15rem; margin-bottom:10px;">${art.title}</h3>
        <p>${art.desc}</p>
        <a href="${art.url}" target="_blank" class="card-link">
          Read Article 
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </a>
      </div>
    </article>
  `).join('');

  initBlogCarousel();
}

function initBlogCarousel() {
  const track = document.getElementById('blogger-news');
  const prevBtn = document.getElementById('blog-prev');
  const nextBtn = document.getElementById('blog-next');
  const dotsContainer = document.getElementById('blog-dots');
  
  if (!track) return;
  const slides = track.querySelectorAll('.carousel-slide');
  if (slides.length === 0) return;
  
  // Render dot indicators
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.classList.add('carousel-dot');
      if (idx === 0) dot.classList.add('active');
      dot.addEventListener('click', () => {
        currentCarouselIndex = idx;
        updateCarousel();
        resetAutoplay();
      });
      dotsContainer.appendChild(dot);
    });
  }
  
  // Navigation button listeners
  prevBtn?.addEventListener('click', () => {
    if (currentCarouselIndex > 0) {
      currentCarouselIndex--;
    } else {
      currentCarouselIndex = getCarouselMaxIndex(slides.length);
    }
    updateCarousel();
    resetAutoplay();
  });
  
  nextBtn?.addEventListener('click', () => {
    const maxIndex = getCarouselMaxIndex(slides.length);
    if (currentCarouselIndex < maxIndex) {
      currentCarouselIndex++;
    } else {
      currentCarouselIndex = 0;
    }
    updateCarousel();
    resetAutoplay();
  });
  
  // Mouse hover pauses autoplay
  const carouselContainer = document.querySelector('.carousel-container');
  carouselContainer?.addEventListener('mouseenter', () => clearInterval(carouselAutoplay));
  carouselContainer?.addEventListener('mouseleave', () => resetAutoplay());
  
  // Trigger initial alignment & setup autoplay
  currentCarouselIndex = 0;
  updateCarousel();
  resetAutoplay();
  
  window.addEventListener('resize', updateCarousel);
}

function getCarouselMaxIndex(totalItems) {
  let visibleItems = 3;
  if (window.innerWidth <= 768) {
    visibleItems = 1;
  } else if (window.innerWidth <= 992) {
    visibleItems = 2;
  }
  return Math.max(0, totalItems - visibleItems);
}

function updateCarousel() {
  const track = document.getElementById('blogger-news');
  const dots = document.querySelectorAll('.carousel-dot');
  if (!track) return;
  
  const slides = track.querySelectorAll('.carousel-slide');
  if (slides.length === 0) return;
  
  const maxIndex = getCarouselMaxIndex(slides.length);
  if (currentCarouselIndex > maxIndex) {
    currentCarouselIndex = maxIndex;
  }
  
  const slideWidth = slides[0].getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(track).gap) || 0;
  
  const offset = currentCarouselIndex * (slideWidth + gap);
  track.style.transform = `translateX(-${offset}px)`;
  
  // Highlight active dot index
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentCarouselIndex);
  });
}

function resetAutoplay() {
  clearInterval(carouselAutoplay);
  carouselAutoplay = setInterval(() => {
    const track = document.getElementById('blogger-news');
    if (!track) return;
    const slides = track.querySelectorAll('.carousel-slide');
    const maxIndex = getCarouselMaxIndex(slides.length);
    if (currentCarouselIndex < maxIndex) {
      currentCarouselIndex++;
    } else {
      currentCarouselIndex = 0;
    }
    updateCarousel();
  }, 5000);
}

/* ==========================================================================
   5. Secure Forms & Dual Lead Flow
   ========================================================================== */
function initInquiryForm() {
  const form = document.getElementById('inquiry-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const gdprCheck = document.getElementById('gdpr-agreement');
    if (gdprCheck && !gdprCheck.checked) {
      alert('You must accept the Privacy Policy and consent to GDPR guidelines before submitting your inquiry.');
      return;
    }
    
    // Assemble form data
    const name = document.getElementById('contact-name')?.value || '';
    const company = document.getElementById('contact-company')?.value || '';
    const email = document.getElementById('contact-email')?.value || '';
    const phone = document.getElementById('contact-phone')?.value || '';
    const desc = document.getElementById('contact-message')?.value || '';
    const segment = document.getElementById('contact-segment')?.value || 'General Inquiry';
    
    const formSubmitUrl = form.action;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending Secure Inquiry...';
    }
    
    try {
      if (formSubmitUrl && formSubmitUrl.includes('formspree')) {
        await fetch(formSubmitUrl, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' }
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("Mock form submission details:", { name, company, email, phone, desc, segment });
      }
      
      const waText = encodeURIComponent(`Hi Lentotech, I just submitted an inquiry for [${segment}] service via your portal.\nName: ${name}\nCompany: ${company}\nEmail: ${email}\nDetails: ${desc}`);
      const waRedirectUrl = `https://wa.me/message/D2ij4kMatiy4s5UUDO7pHd?text=${waText}`;
      
      alert('Thank you! Your secure inquiry has been logged. Clicking OK will redirect you to Lentotech Official WhatsApp Support for immediate service.');
      window.location.href = waRedirectUrl;
      
    } catch (err) {
      console.error('Inquiry Submission Error:', err);
      alert('Error sending message. Please email us directly at ' + atob(OBFUSCATED_EMAIL));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Secure Inquiry';
      }
    }
  });
}

/* ==========================================================================
   6. R&D Pipeline Scroll Animations
   ========================================================================== */
function initPipelineAnimations() {
  const bars = document.querySelectorAll('.stage-progress');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const targetWidth = entry.target.dataset.progress || '100%';
        entry.target.style.transition = 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
        entry.target.style.width = targetWidth;
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  bars.forEach(bar => observer.observe(bar));
}
