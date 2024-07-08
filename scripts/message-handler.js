import { enviarNotificacion } from './notification-handler.js';

export function manejarMensajeRecibido(instance, message) {
    agregarMensaje(instance, message);
    if (instance.searchFilter && message.payloadString.includes(instance.searchFilter) && Notification.permission === "granted") {
        enviarNotificacion(`Nuevo mensaje en topico: ${message.destinationName}`, message.payloadString);
    }
}

export function agregarMensaje(instance, mensaje) {
    const topicComplete = mensaje.destinationName;
    const topic = topicComplete.substring(topicComplete.lastIndexOf('/') + 1);
    instance.lastUpdateTime.set(topic, Date.now());

    if (!instance.topics.has(topic)) {
        instance.topics.set(topic, []);
        instance.messageCounters.set(topic, 0); // Inicializar contador de mensajes
        instance.agregarOpcionTopico(topic);
        instance.actualizarContadorTopicos();
    }

    instance.topics.get(topic).push(mensaje.payloadString);
    instance.messageCounters.set(topic, instance.messageCounters.get(topic) + 1); // Incrementar contador de mensajes

    if (instance.topics.get(topic).length > parseInt(instance.inputNum.value, 10)) {
        instance.topics.get(topic).shift(); // Eliminar mensajes antiguos
    }
    instance.actualizarContadorTopico(topic);

    if (instance.topicSelector.value === topic) {
        instance.mostrarMensajes(topic);
    }
}

export function actualizarContadorTopicos(instance) {
    instance.topicCount = instance.topics.size;
    instance.shadowRoot.getElementById('topicCount').textContent = instance.topicCount;
}

export function agregarOpcionTopico(instance, topico) {
    const option = document.createElement('option');
    option.value = topico;
    option.textContent = `${topico} (0)`;
    instance.topicSelector.appendChild(option);
    instance.ordenarTopicos();
}

export function actualizarContadorTopico(instance, topico) {
    const totalMessages = instance.messageCounters.get(topico);
    const option = instance.topicSelector.querySelector(`option[value="${topico}"]`);
    if (option) {
        option.textContent = `${topico} ***** (${totalMessages})`;
    }
}

export function ordenarTopicos(instance) {
    const options = Array.from(instance.topicSelector.options);
    options.sort((a, b) => a.textContent.localeCompare(b.textContent));
    instance.topicSelector.innerHTML = '';
    options.forEach(option => instance.topicSelector.appendChild(option));
}

export function mostrarMensajes(instance, topico) {
    const mensajes = instance.topics.get(topico) || [];
    instance.messageDisplay.innerHTML = mensajes.map(mensaje => `<div>${mensaje}</div>`).join('');
}

export function limpiarYReiniciar(instance) {
    instance.topics.clear();
    instance.messageCounters.clear(); // Limpiar contador de mensajes
    instance.messageDisplay.innerHTML = '';
    instance.topicSelector.innerHTML = '';
    instance.actualizarContadorTopicos();
    if (instance.hasAttribute('filter')) {
        instance.mqttHandler.subscribe(instance.getAttribute('filter'));
    }
}
