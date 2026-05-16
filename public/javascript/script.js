// ==========================================
// COOKBOOK — Frontend Scripts 2026
// ==========================================

// --- Text counter for textarea fields ---
function textCounter(field, countField, maxlimit) {
  if (field.value.length > maxlimit) {
    field.value = field.value.substring(0, maxlimit);
  }
  countField.value = maxlimit - field.value.length;
}

// ==========================================
// ADD RECIPE — Ingredient builder
// ==========================================

(function () {
  var addIngredientsBtn = document.getElementById('addIngredientsBtn');
  var ingredientList = document.querySelector('.ingredientList');
  var removeButton = document.getElementById('removeIngredientsBtn');

  if (!addIngredientsBtn || !ingredientList) return;

  var ingredientDiv = document.querySelectorAll('.ingredientDiv')[0];

  addIngredientsBtn.addEventListener('click', function () {
    var newIngredients = ingredientDiv.cloneNode(true);
    var input = newIngredients.getElementsByTagName('input')[0];
    input.value = '';
    ingredientList.appendChild(newIngredients);
  });

  if (removeButton) {
    removeButton.addEventListener('click', function () {
      var items = ingredientList.querySelectorAll('.ingredientDiv');
      if (items.length > 1) {
        ingredientList.lastElementChild.remove();
      }
    });
  }
})();

// ==========================================
// SESSION STORAGE — Publisher name
// ==========================================

(function () {
  var publisher = document.getElementById('publisher');
  if (!publisher) return;

  var saved = sessionStorage.getItem('publisher');
  if (saved) publisher.value = saved;

  publisher.addEventListener('input', function () {
    sessionStorage.setItem('publisher', publisher.value);
  });
})();

// ==========================================
// BOOTSTRAP TOOLTIPS
// ==========================================

(function () {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function (el) {
    new bootstrap.Tooltip(el);
  });
})();

// ==========================================
// NAVBAR — Shadow on scroll
// ==========================================

(function () {
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  function onScroll() {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();

// ==========================================
// SCROLL ANIMATIONS — Cards fade-in
// ==========================================

function initScrollAnimations() {
  if (!('IntersectionObserver' in window)) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

  document.querySelectorAll('.card').forEach(function (card) {
    card.classList.add('animate');
    observer.observe(card);
  });
}

// ==========================================
// CATEGORY FILTER — User profile recipes
// ==========================================

function initCategoryFilter() {
  var btns = document.querySelectorAll('.category-filter-btn');
  var cards = document.querySelectorAll('.recipe-card-item');
  if (!btns.length || !cards.length) return;

  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var filter = btn.dataset.filter;
      cards.forEach(function (card) {
        var show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? '' : 'none';
        if (show) card.classList.add('visible'); // ensure visible after filter
      });
    });
  });
}

// ==========================================
// PAGINATION (all-recipes page)
// ==========================================

var list = [];
var pageList = [];
var currentPage = 1;
var numberPerPage = 10;
var numberOfPages = 0;

function makeList() {
  for (var x = 0; x < 200; x++) list.push(x);
  numberOfPages = getNumberOfPages();
}
function getNumberOfPages() {
  return Math.ceil(list.length / numberPerPage);
}
function nextPage() { currentPage += 1; loadList(); }
function previousPage() { currentPage -= 1; loadList(); }
function firstPage() { currentPage = 1; loadList(); }
function lastPage() { currentPage = numberOfPages; loadList(); }

function loadList() {
  var begin = (currentPage - 1) * numberPerPage;
  var end = begin + numberPerPage;
  pageList = list.slice(begin, end);
  drawList();
  checkPagination();
}

function drawList() {
  var listEl = document.getElementById('list');
  if (!listEl) return;
  listEl.textContent = '';
  pageList.forEach(function (item) {
    var p = document.createElement('p');
    p.textContent = item;
    listEl.appendChild(p);
  });
}

function checkPagination() {
  var next = document.getElementById('next');
  var prev = document.getElementById('previous');
  var first = document.getElementById('first');
  var last = document.getElementById('last');
  if (next) next.disabled = currentPage === numberOfPages;
  if (prev) prev.disabled = currentPage === 1;
  if (first) first.disabled = currentPage === 1;
  if (last) last.disabled = currentPage === numberOfPages;
}

function load() {
  makeList();
  loadList();
}

// ==========================================
// INIT
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
  initScrollAnimations();
  initCategoryFilter();
});

