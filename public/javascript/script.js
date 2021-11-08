////// add ingredients /////
let addIngredientsBtn = document.getElementById('addIngredientsBtn');
let ingredientList = document.querySelector('.ingredientList');
let ingredientDiv = document.querySelectorAll('.ingredientDiv')[0];

addIngredientsBtn.addEventListener('click', function(){
  let newIngredients = ingredientDiv.cloneNode(true);
  let input = newIngredients.getElementsByTagName('input')[0];
  input.value = '';
  ingredientList.appendChild(newIngredients);
});

//sessionStorage
if(window.sessionStorage) {
  let publisher = document.getElementById('publisher');
  let title = document.getElementById('title');
  let time = document.getElementById('time');
  let describe = document.getElementById('describe');
  let preparation = document.getElementById('preparation');

  publisher.value = sessionStorage.getItem('publisher');
  title.value = sessionStorage.getItem('title');
  time.value = sessionStorage.getItem('time');
  describe.value = sessionStorage.getItem('describe');
  preparation.value = sessionStorage.getItem('preparation');

  publisher.addEventListener('input', ()=> {
    sessionStorage.setItem('publisher', publisher.value);
  })
  title.addEventListener('input', ()=> {
    sessionStorage.setItem('title', title.value);
  })
  time.addEventListener('input', ()=> {
    sessionStorage.setItem('time', time.value);
  })
  describe.addEventListener('input', ()=> {
    sessionStorage.setItem('describe', describe.value);
  })
  preparation.addEventListener('input', ()=> {
    sessionStorage.setItem('preparation', preparation.value);
  })
}


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