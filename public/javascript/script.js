////// add ingredients /////
let addIngredientsBtn = document.getElementById('addIngredientsBtn');
let ingredientList = document.querySelector('.ingredientList');
let ingredientDiv = document.querySelectorAll('.ingredientDiv')[0];

let removeButton = document.getElementById('removeIngredientsBtn');

addIngredientsBtn.addEventListener('click', function(){
  let newIngredients = ingredientDiv.cloneNode(true);
  let input = newIngredients.getElementsByTagName('input')[0];
  input.value = '';
  ingredientList.appendChild(newIngredients);
});

// counter letters add recipes
function textCounter( field, countfield, maxlimit ) {
  if ( field.value.length > maxlimit ) {
   field.value = field.value.substring( 0, maxlimit );
   field.focus();
   return false;
  } else {
   countfield.value = maxlimit - field.value.length;
  }
 }

// remove ingredients
removeButton.addEventListener('click', () => {
  ingredientList.lastChild.remove();
})

//sessionStorage
if(window.sessionStorage) {
  let publisher = document.getElementById('publisher');

  publisher.value = sessionStorage.getItem('publisher');

  publisher.addEventListener('input', ()=> {
    sessionStorage.setItem('publisher', publisher.value);
  })
}

// Tooltips
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

// clear input
// const newsletter_input = document.getElementById(newsletter);
// const newsletter_button = document.querySelector('.button-newsletter');

// newsletter_button.addEventListener('click', () => {
//   newsletter_input = '';
// })

//////   pages //////
var list = new Array();
var pageList = new Array();
var currentPage = 1;
var numberPerPage = 10;
var numberOfPages = 0;

function makeList() {
for (x = 0; x < 200; x++)
    list.push(x);

numberOfPages = getNumberOfPages();
}

function getNumberOfPages() {
return Math.ceil(list.length / numberPerPage);
}

function nextPage() {
currentPage += 1;
loadList();
}

function previousPage() {
currentPage -= 1;
loadList();
}

function firstPage() {
currentPage = 1;
loadList();
}

function lastPage() {
currentPage = numberOfPages;
loadList();
}

function loadList() {
var begin = ((currentPage - 1) * numberPerPage);
var end = begin + numberPerPage;

pageList = list.slice(begin, end);
drawList();
check();
}

function drawList() {
document.getElementById("list").innerHTML = "";
for (r = 0; r < pageList.length; r++) {
    document.getElementById("list").innerHTML += pageList[r] + "<br/>";
}
}

function check() {
document.getElementById("next").disabled = currentPage == numberOfPages ? true : false;
document.getElementById("previous").disabled = currentPage == 1 ? true : false;
document.getElementById("first").disabled = currentPage == 1 ? true : false;
document.getElementById("last").disabled = currentPage == numberOfPages ? true : false;
}

function load() {
makeList();
loadList();
}

window.onload = load;
////// end pages //////


// google translate
function googleTranslateElementInit() {
  new google.translate.TranslateElement({pageLanguage: 'pl', layout: google.translate.TranslateElement.InlineLayout.SIMPLE}, 'google_translate_element');
}