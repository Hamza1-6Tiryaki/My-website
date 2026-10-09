// EmailJS initialization
emailjs.init('a0zPkJaPChPl7qlFo');

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
const rootElement = document.documentElement;

// Function to set theme
function setTheme(theme) {
    if (theme === 'light') {
        rootElement.classList.add('light-mode');
    } else {
        rootElement.classList.remove('light-mode');
    }
    localStorage.setItem('theme', theme);
}

// Function to toggle theme
function toggleTheme() {
    const currentTheme = rootElement.classList.contains('light-mode') ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Initialize theme on load (default to dark mode)
const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

// Add click event listener to theme toggle button
if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

// Mobile Menu Toggle
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const navRight = document.getElementById('nav-right');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenuToggle.classList.toggle('active');
        navRight.classList.toggle('active');
    });

    // Close menu when clicking on a nav link
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuToggle.classList.remove('active');
            navRight.classList.remove('active');
        });
    });
}

// Source texts (English). Other languages are translated on demand
// with Google Cloud Translation through the server's /api/translate endpoint.
const SOURCE_LANG = 'en';
const TRANSLATE_API_URL = 'translate.php';
const CACHE_PREFIX = 'gt_cache_v1_';

const sourceTexts = {
    home: "Home",
    about: "About",
    projects: "Projects",
    contact: "Contact",
    news: "News",
    heroTitle: "Hello, I'm Hamza<br>Software Engineer",
    heroDesc: "I am a web developer. I have been taking artificial intelligence trainings for a short time.",
    viewProjects: "View Projects",
    skillsTitle: "Skills",
    aboutTitle: "Who Am I?",
    aboutDesc: "I am a software developer with a passion for creating interactive applications. I have a strong foundation in web and mobile development and love learning new technologies.",
    learningJourney: "Learning Journey",
    internshipTitle: "Internship",
    internshipDesc: "I did an internship at a company called DizaynPack",
    graduationTitle: "Graduation",
    graduationDesc: "I graduated from Borusan Asım Kocabıyık MTAL",
    educationTitle: "Education",
    educationDesc: "I started the software engineering department at Atatürk University.",
    projectsTitle: "Projects",
    project1Title: "Smart Study Scheduler",
    project1Desc: "This app will be coming soon. This app will be a nice cross-platform app that can create a study schedule.",
    project2Title: "Cuzdan Dostu",
    project2Desc: "Take control of both your shopping and your finances with this site!",
    project3Title: "AR-based virtual fitting room",
    project3Desc: "The opportunity to try on clothes without going to the store!",
    project4Title: "Coming soon",
    project4Desc: "Coming soon",
    newsTitle: "Latest News",
    wolfAiTitle: "Wolf AI",
    wolfAiDesc: "Coming Soon - An exciting new AI project is in development!",
    contactTitle: "Contact",
    contactDesc: "I'd love to hear from you! Please fill out this form and I will get in touch with you as soon as possible.",
    goProjectBtn: "Go to Project!",
    sendBtn: "Send Message",
    contactInfoTitle: "Contact Information",
    namePlaceholder: "Name",
    emailPlaceholder: "Email",
    messagePlaceholder: "Message",
    alertSuccess: "Thank you {name}! Your message has been sent successfully.",
    alertError: "Please fill in all fields.",
    emailSending: "Sending...",
    emailSuccess: "Email sent successfully!",
    emailError: "Failed to send email. Please try again."
};

// Names/placeholders that must not be translated
const PROTECTED_TERMS = ['Wolf AI', 'DizaynPack', 'Borusan Asım Kocabıyık MTAL', 'Cuzdan Dostu'];
const PROTECTED_REGEX = new RegExp(
    PROTECTED_TERMS.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '|\\{\\w+\\}',
    'g'
);

// Wrap protected terms so Google leaves them untouched (format: 'html' honours "notranslate")
function protect(text) {
    return text.replace(PROTECTED_REGEX, match => `<span class="notranslate">${match}</span>`);
}

// Google returns HTML-escaped text (e.g. &#39;); convert it to plain text for alerts/placeholders
function toPlainText(html) {
    return new DOMParser().parseFromString(html, 'text/html').documentElement.textContent;
}

function loadCache(lang) {
    try {
        return JSON.parse(localStorage.getItem(CACHE_PREFIX + lang)) || {};
    } catch {
        return {};
    }
}

function saveCache(lang, cache) {
    try {
        localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(cache));
    } catch {
        // Storage full or unavailable: translations simply won't be cached
    }
}

// Translate a list of English strings; only strings missing from the cache hit the API
async function translateTexts(texts, target) {
    const cache = loadCache(target);
    const missing = texts.filter(text => !(text in cache));

    if (missing.length > 0) {
        const response = await fetch(TRANSLATE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: missing.map(protect), target })
        });
        if (!response.ok) {
            throw new Error(`Translation request failed (${response.status})`);
        }
        const { translations } = await response.json();
        missing.forEach((text, i) => { cache[text] = translations[i]; });
        saveCache(target, cache);
    }

    return texts.map(text => cache[text]);
}

let currentStrings = sourceTexts;

// Plain-text version of a string (for alerts, placeholders, button labels)
function getText(key) {
    return toPlainText(currentStrings[key] ?? sourceTexts[key]);
}

// Update all DOM elements marked with data-i18n / data-i18n-placeholder
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (currentStrings[key]) {
            element.innerHTML = currentStrings[key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (currentStrings[key]) {
            element.placeholder = getText(key);
        }
    });
}

const languageSelector = document.getElementById('language-selector');
let languageRequestId = 0;

async function changeLanguage(lang) {
    const requestId = ++languageRequestId;
    let strings = sourceTexts;

    if (lang !== SOURCE_LANG) {
        try {
            const keys = Object.keys(sourceTexts);
            const translated = await translateTexts(keys.map(key => sourceTexts[key]), lang);
            strings = Object.fromEntries(keys.map((key, i) => [key, translated[i]]));
        } catch (error) {
            console.error('Translation failed, falling back to English:', error);
            // Ignore if the user already picked another language in the meantime
            if (requestId === languageRequestId) {
                currentStrings = sourceTexts;
                applyTranslations();
                document.documentElement.lang = SOURCE_LANG;
                languageSelector.value = SOURCE_LANG;
            }
            return;
        }
    }

    // A newer language change superseded this one
    if (requestId !== languageRequestId) return;

    currentStrings = strings;
    applyTranslations();
    document.documentElement.lang = lang;
    localStorage.setItem('selectedLanguage', lang);
}

// Initialize language on load
const savedLanguage = localStorage.getItem('selectedLanguage') || SOURCE_LANG;
languageSelector.value = savedLanguage;
changeLanguage(savedLanguage);

languageSelector.addEventListener('change', (e) => {
    changeLanguage(e.target.value);
});

// Contact Form Handling with EmailJS
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        const name = this.querySelector('input[name="from_name"]').value.trim();
        const email = this.querySelector('input[name="from_email"]').value.trim();
        const message = this.querySelector('textarea[name="message"]').value.trim();

        if (!name || !email || !message) {
            alert(getText('alertError'));
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = getText('emailSending');

        const templateParams = {
            from_name: name,
            from_email: email,
            message: message
        };

        emailjs.send('service_vvhsimr', 'template_iqz64vi', templateParams)
            .then(function (response) {
                console.log('SUCCESS!', response.status, response.text);
                alert(getText('emailSuccess'));
                contactForm.reset();
            }, function (error) {
                console.log('FAILED...', error);
                alert(getText('emailError'));
            })
            .finally(function () {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            });
    });
}

// Scroll Animation Functions
function checkIfInView(element) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowTop = window.pageYOffset || document.documentElement.scrollTop;
    const elementTop = rect.top + windowTop;
    const elementBottom = elementTop + rect.height;
    const viewportTop = windowTop;
    const viewportBottom = viewportTop + windowHeight;

    // Element is in view if any part of it is visible
    return elementBottom > viewportTop && elementTop < viewportBottom - 100;
}

function animateElements() {
    const animatedElements = document.querySelectorAll(
        '.hero-title, .skill-card, .project-card, .news-card, .social-icon'
    );

    animatedElements.forEach(el => {
        if (checkIfInView(el)) {
            el.classList.add('animate');
        } else {
            // Remove animate class when element leaves viewport to re-trigger on scroll back
            el.classList.remove('animate');
        }
    });
}

// Use IntersectionObserver if available, otherwise use scroll events
if ('IntersectionObserver' in window) {
    const observerOptions = {
        threshold: 0.05,
        rootMargin: '0px 0px -100px 0px'
    };
    const animateOnScroll = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            } else {
                // Remove animate class when element leaves viewport to re-trigger on scroll back
                entry.target.classList.remove('animate');
            }
        });
    }, observerOptions);
    // Observe all animatable elements
    document.addEventListener('DOMContentLoaded', () => {
        const animatedElements = document.querySelectorAll(
            '.hero-title, .skill-card, .project-card, .news-card, .social-icon'
        );

        animatedElements.forEach(el => animateOnScroll.observe(el));

        // Trigger initial check
        animateElements();
    });
} else {
    // Fallback for browsers that don't support IntersectionObserver
    document.addEventListener('DOMContentLoaded', () => {
        animateElements();
        window.addEventListener('scroll', animateElements);
        window.addEventListener('resize', animateElements);
    });
}
// Also trigger animations on page load (after a small delay to ensure DOM is ready)
window.addEventListener('load', () => {
    setTimeout(animateElements, 100);
});