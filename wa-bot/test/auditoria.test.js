const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { extraerDatosLead, validarCedulaEcuador } = require('../crm-extractor');
const SessionStore = require('../session-store');

describe('Suite de Regresión y Validación de Auditoría Técnica (C1-C5, M6, M9)', () => {
  const testDbPath = path.join(__dirname, 'test_auditoria.db');
  let store;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    store = new SessionStore(testDbPath);
  });

  afterEach(() => {
    if (store) store.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  // =======================================================
  // C1: MEMORIA ZERO-AMNESIA PERSISTE TRAS 24 HORAS
  // =======================================================
  test('C1: getHistory(phone) no debe borrar la ficha CRM tras expirar el historial (>24h)', () => {
    const phone = '593999999999';
    // 1. Crear lead y registrar datos
    store.obtenerOCrearLead(phone);
    store.actualizarLead(phone, {
      nombre: 'Juan Test',
      ciudad: 'Guayaquil',
      carrera: 'Licenciatura en Ciencias de la Educación',
      cedula: '0923456781'
    });

    // 2. Insertar historial envejecido (25 horas atrás)
    const twentyFiveHoursAgo = Date.now() - (25 * 60 * 60 * 1000);
    const stmt = store.db.prepare('INSERT INTO sessions (phone, history, updated_at) VALUES (?, ?, ?)');
    stmt.run(phone, JSON.stringify([{ role: 'user', content: 'hola ayer' }]), twentyFiveHoursAgo);

    // 3. Invocar getHistory: debe expirar la sesión vieja pero NO borrar crm_leads
    const hist = store.getHistory(phone);
    assert.deepEqual(hist, [], 'El historial de chat viejo debe estar vacío tras expirar');

    // 4. Verificar que la ficha CRM permanezca intacta
    const lead = store.getLead(phone);
    assert.ok(lead, 'La ficha CRM debe existir');
    assert.equal(lead.nombre, 'Juan Test', 'El nombre debe conservarse');
    assert.equal(lead.ciudad, 'Guayaquil', 'La ciudad debe conservarse');
    assert.equal(lead.cedula, '0923456781', 'La cédula debe conservarse');
    assert.equal(lead.carrera, 'Licenciatura en Ciencias de la Educación', 'La carrera debe conservarse');
  });

  // =======================================================
  // C2: CÉDULAS ECUADOR (MÓDULO 10) Y FILTRO ANTI-CELULARES
  // =======================================================
  test('C2: validarCedulaEcuador valida correctamente cédulas reales y descarta celulares o dígitos inválidos', () => {
    // 0923456781 -> Guayas (09), tercer dígito 2 (<6), suma: 0*2+9*1+2*2+3*1+4*2+5*1+6*2+7*1+8*2 = 0+9+4+3+8+5+(12-9=3)+7+(16-9=7)=46. (10 - 6) = 4 != 1.
    // Usemos una cédula matemáticamente válida de Guayas:
    // Cédula: 0926615701 -> 0*2 + 9*1 + 2*2 + 6*1 + 6*2(3) + 1*1 + 5*2(1) + 7*1 + 0*2(0) = 0+9+4+6+3+1+1+7+0 = 31. 40 - 31 = 9 != 1.
    // Cédula de prueba válida oficial SRI: 0910000008 -> 0 + 9 + 2 + 0 + 0 + 0 + 0 + 0 + 0 = 11. 20 - 11 = 9 != 8.
    // Algoritmo:
    // 1710034065 -> Pichincha (17):
    // 1*2=2, 7*1=7, 1*2=2, 0*1=0, 0*2=0, 3*1=3, 4*2=8, 0*1=0, 6*2=12-9=3.
    // Suma: 2+7+2+0+0+3+8+0+3 = 25.
    // Verificador: (10 - (25 % 10)) % 10 = (10 - 5) % 10 = 5. Último dígito: 5 -> VÁLIDA!
    assert.equal(validarCedulaEcuador('1710034065'), true, '1710034065 debe ser válida');
    assert.equal(validarCedulaEcuador('0991234567'), false, 'Celular 0991234567 debe ser inválido como cédula');
    assert.equal(validarCedulaEcuador('0000000000'), false, 'Provincia 00 debe ser inválida');
    assert.equal(validarCedulaEcuador('2500000001'), false, 'Provincia 25 debe ser inválida');
  });

  test('C2: extraerDatosLead no captura celular como cédula y sí captura cédula válida', () => {
    // Celular explícito
    const resCel = extraerDatosLead('mi numero de celular es 0991234567');
    assert.equal(resCel.cedula, undefined, 'No debe capturar número precedido por celular');

    // Cédula válida con contexto
    const resCed = extraerDatosLead('ayudame con el registro mi cedula 1710034065');
    assert.equal(resCed.cedula, '1710034065', 'Debe capturar la cédula válida');
  });

  // =======================================================
  // C3: RAMA DEL MBA NO QUEDA OCULTA POR ADMINISTRACIÓN
  // =======================================================
  test('C3: Consultas de maestría en administración se clasifican como MBA y no como grado', () => {
    const resMba1 = extraerDatosLead('cuanto cuesta la maestria en administracion?');
    assert.equal(resMba1.carrera, 'MBA (Administración de Empresas)');

    const resMba2 = extraerDatosLead('quiero informacion del mba');
    assert.equal(resMba2.carrera, 'MBA (Administración de Empresas)');

    const resGrado = extraerDatosLead('quiero estudiar administracion de empresas');
    assert.equal(resGrado.carrera, 'Licenciatura en Administración de Empresas');
  });

  // =======================================================
  // C4: NEGACIONES DE EXPERIENCIA Y LÍMITES DE PALABRA
  // =======================================================
  test('C4: Negaciones de experiencia no se clasifican como PE-15 y "Hermano" no genera falsos positivos', () => {
    // Negación explícita
    const resNeg = extraerDatosLead('soy docente pero no tengo experiencia laboral');
    assert.notEqual(resNeg.perfil, 'docente_4anos');

    // Colegio San Hermano Pedro (contiene "Hermano" que tiene substring "ano")
    const resHermano = extraerDatosLead('soy docente del colegio San Hermano Pedro');
    assert.notEqual(resHermano.perfil, 'docente_4anos');

    // Bachiller que menciona colegio
    const resBachiller = extraerDatosLead('terminé el colegio, soy bachiller');
    assert.equal(resBachiller.perfil, 'bachiller');

    // Docente con años de experiencia real
    const resExp = extraerDatosLead('soy docente con 5 años de experiencia');
    assert.equal(resExp.perfil, 'docente_4anos');
  });

  // =======================================================
  // C5: PATRÓN DE NOMBRES EXCLUYE FÓRMULAS Y PROFESIONES
  // =======================================================
  test('C5: "soy docente, doy clases" no se captura como nombre propio', () => {
    const resInvalido = extraerDatosLead('soy docente, doy clases hace 5 años');
    assert.notEqual(resInvalido.nombre, 'Soy Docente', 'No debe llamar "Soy Docente" al usuario');
    assert.equal(resInvalido.nombre, undefined, 'Debe dejar el nombre pendiente');

    const resValido = extraerDatosLead('caro lion, de Daule soy bachiller');
    assert.equal(resValido.nombre, 'Caro Lion', 'Debe capturar el nombre real');
    assert.equal(resValido.ciudad, 'Daule', 'Debe capturar la ciudad');
  });

  // =======================================================
  // M6 & M9: ETAPA AUTO-PROGRESSION Y BUDGET DE CARACTERES
  // =======================================================
  test('M6: avanzarEtapa asigna automáticamente etapas del embudo v2', () => {
    const phone = '593888888888';
    store.obtenerOCrearLead(phone);

    // Con nombre, ciudad y perfil -> lead_calificado
    store.actualizarLead(phone, { nombre: 'Carlos Ruiz', ciudad: 'Milagro', perfil: 'bachiller' });
    const e1 = store.avanzarEtapa(phone);
    assert.equal(e1, 'lead_calificado');
    assert.equal(store.getLead(phone).etapa, 'lead_calificado');

    // Con cédula válida -> cedula_capturada
    store.actualizarLead(phone, { cedula: '1710034065' });
    const e2 = store.avanzarEtapa(phone);
    assert.equal(e2, 'cedula_capturada');
    assert.equal(store.getLead(phone).etapa, 'cedula_capturada');

    // Con confirmación -> ficha_completa
    store.actualizarLead(phone, { confirmado: 1 });
    const e3 = store.avanzarEtapa(phone);
    assert.equal(e3, 'ficha_completa');
    assert.equal(store.getLead(phone).etapa, 'ficha_completa');
  });

  test('M9: appendMessage recorta el historial por límite de 8.000 caracteres', () => {
    const phone = '593777777777';
    // Insertar mensajes largos
    const textoLargo = 'A'.repeat(2000);
    for (let i = 0; i < 6; i++) {
      store.appendMessage(phone, 'user', `Mensaje ${i}: ${textoLargo}`);
    }

    const hist = store.getHistory(phone);
    const totalChars = hist.reduce((acc, m) => acc + m.content.length, 0);
    assert.ok(totalChars <= 8500, `El historial acumulado (${totalChars} chars) no debe exceder el presupuesto seguro`);
  });
});
