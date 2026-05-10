function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}
function waitForRender() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}
window.showQuiz = function () {
  document.getElementById("quizModal").style.display = "flex";
}

window.checkQuiz = function () {
  const q1 = document.querySelector('input[name="q1"]:checked')?.value;
  const q2 = document.querySelector('input[name="q2"]:checked')?.value;
  const q3 = document.querySelector('input[name="q3"]:checked')?.value;

  if (!q1 || !q2 || !q3) {
    alert("すべて選択してください");
    return;
  }

  if (q1 === "40" && q2 === "hard" && q3 === "25") {
    localStorage.setItem("quizPassed", window.QUIZ_VERSION);
    document.getElementById("quizModal").style.display = "none";
    alert("✔ 利用準備OK！ツールを使えます");
  } else {
    alert("もう一度確認してください\nヒント：基本距離は40mです");
  }
}