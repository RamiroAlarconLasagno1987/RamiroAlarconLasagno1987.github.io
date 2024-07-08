export function cargarCSS(shadowRoot) {
    fetch('styles/topic-viewer.css')
        .then(respuesta => respuesta.text())
        .then(css => aplicarEstilos(shadowRoot, css));
}

export function aplicarEstilos(shadowRoot, css) {
    const style = document.createElement('style');
    style.textContent = css;
    shadowRoot.appendChild(style);
}

export function configurarHTML(shadowRoot) {
    shadowRoot.innerHTML = `
        <div class="input-container">
            <input type="text" id="topicSearch" placeholder="Buscar en tópicos...">
            <button id="searchButton">Aceptar</button>
        </div>
        <div style="display: flex; align-items: center;">
            <select id="topicSelector"></select>
            <div id="topicCount" style="margin-left: 10px;">0</div>
            <input type="number" id="inputNum" value="10" min="1" style="margin-left: 10px;">
        </div>
        <div id="messageDisplay"></div>
    `;
}

export function configurarElementos(shadowRoot) {
    return {
        topicSelector: shadowRoot.getElementById('topicSelector'),
        messageDisplay: shadowRoot.getElementById('messageDisplay'),
        topicSearch: shadowRoot.getElementById('topicSearch'),
        searchButton: shadowRoot.getElementById('searchButton'),
        inputNum: shadowRoot.getElementById('inputNum')
    };
}
