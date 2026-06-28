// ==UserScript==
// @name         Guanabara - suporte
// @namespace    http://tampermonkey.net/
// @version      1.10
// @author       William Rodrigues
// @match        *://*.smarttravelit.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// =========================================================================
// CONFIGURAÇÃO DE TIPOGRAFIA
// =========================================================================
// =========================================================================
// CONFIGURAÇÃO DE TIPOGRAFIA: ROBOTO
// =========================================================================
const estiloFonte = document.createElement('style');
estiloFonte.innerHTML = "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');";
document.head.appendChild(estiloFonte);

const FONTE_PADRAO = "'Roboto', sans-serif";
// =========================================================================
// SCRIPT 1: TABELA DE HORÁRIOS
// =========================================================================
(function() {
    'use strict';

    function limparTudo() { sessionStorage.removeItem("william_credito_remarcacao"); }

    try {
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav && nav.type === "reload") { limparTudo(); }
    } catch (e) {}

    let linkAtual = window.location.hash;
    setInterval(() => {
        if (window.location.hash !== linkAtual) {
            linkAtual = window.location.hash;
            if (linkAtual === '#/' || linkAtual === '#/home' || linkAtual === '#/dashboard' || linkAtual === '') {
                limparTudo();
            }
        }
    }, 1500);

    function setCredito(valor) { sessionStorage.setItem("william_credito_remarcacao", valor.toString()); }
    function getCredito() {
        const valor = sessionStorage.getItem("william_credito_remarcacao");
        return valor ? parseFloat(valor) : 0;
    }
    function formatarMoeda(valor) { return "R$ " + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }

    function extrairNumero(texto) {
        if (!texto) return 0;
        let limpo = texto.replace(/[^\d,]/g, '').replace(',', '.');
        return parseFloat(limpo) || 0;
    }

    function capturarValorLiquido() {
        const ths = Array.from(document.querySelectorAll('th'));
        const idx = ths.findIndex(th => th.innerText.toUpperCase().includes('LÍQUIDO'));
        if (idx !== -1) {
            const td = document.querySelector('tbody tr td:nth-child(' + (idx + 1) + ')');
            if (td && !td.dataset.marcado) {
                const valorNum = extrairNumero(td.innerText);
                if (valorNum > 0) {
                    setCredito(valorNum);
                    td.style.backgroundColor = "#d4edda";
                    td.style.border = "3px solid #28a745";
                    td.dataset.marcado = "true";
                }
            }
        }
    }

    function capturarTrecho() {
        let origem = document.querySelector('#txt-origem')?.value || "";
        let destino = document.querySelector('#txt-destino')?.value || "";
        if (!origem || !destino) {
            const textoTopo = document.body.innerText.substring(0, 1500);
            const match = textoTopo.match(/de\s+(.*)\s+para\s+(.*?)(?:\n|em |$)/i);
            if (match) { origem = match[1].trim(); destino = match[2].trim(); }
        }

        let isVolta = false;
        let abasAtivas = document.querySelectorAll('.active, .current, .selected');
        for (let i = 0; i < abasAtivas.length; i++) {
            let txtAba = abasAtivas[i].innerText.toUpperCase();
            if (txtAba.includes('VOLTA') && !txtAba.includes('IDA E VOLTA') && !txtAba.includes('IDA E RETORNO')) {
                isVolta = true; break;
            }
        }

        if (document.body.innerText.toUpperCase().includes('ESCOLHA SUA VOLTA') ||
            document.body.innerText.toUpperCase().includes('TRECHO DE VOLTA') ||
            document.body.innerText.toUpperCase().includes('SELECIONE A VOLTA')) {
            isVolta = true;
        }

        if (origem && destino) {
            origem = origem.replace(/^[A-Z]+\s*-\s*/i, '')
                           .replace(/\s*-\s*[A-Z]{2}$/i, '')
                           .replace(/\s*\(.*?\)/g, '')
                           .trim();

            destino = destino.replace(/^[A-Z]+\s*-\s*/i, '')
                             .replace(/\s*-\s*[A-Z]{2}$/i, '')
                             .replace(/\s*\(.*?\)/g, '')
                             .trim();

            if (isVolta) return `${destino} ➔ ${origem}`.toUpperCase();
            else return `${origem} ➔ ${destino}`.toUpperCase();
        }
        return "";
    }

    function desenharCartao(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath(); ctx.fill();
    }

    async function desenharECopiarImagem(dados) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const largura = 850;
        const margem = 30;
        const alturaCartao = 90;
        const espacoEntreCartoes = 15;

        let altura = 100;
        if (dados.credito > 0) altura += 105;
        altura += 30;
        altura += (dados.viagens.length * (alturaCartao + espacoEntreCartoes)) + 30;

        canvas.width = largura; canvas.height = altura;

        ctx.fillStyle = '#F4F6F8'; ctx.fillRect(0, 0, largura, altura);
        ctx.fillStyle = '#303F9F'; ctx.fillRect(0, 0, largura, 90);
        ctx.fillStyle = '#FFFFFF';

        const trechoFormatado = dados.trecho ? `${dados.trecho}  |  ` : "";
        const textoCabecalho = `📅 ${dados.isRemarcacao ? 'REMARCAÇÃO' : 'VIAGEM'}: ${trechoFormatado}${dados.dataTexto}`;

        let fontCabecalho = 20;
        ctx.font = `600 ${fontCabecalho}px ${FONTE_PADRAO}`;
        while(ctx.measureText(textoCabecalho).width > largura - (margem * 2) && fontCabecalho > 14) {
            fontCabecalho--;
            ctx.font = `600 ${fontCabecalho}px ${FONTE_PADRAO}`;
        }
        ctx.fillText(textoCabecalho, margem, 55);

        let yAtual = 115;

        if (dados.credito > 0) {
            ctx.fillStyle = '#E8F5E9';
            desenharCartao(ctx, margem, yAtual, largura - (margem * 2), 85, 8);
            ctx.strokeStyle = '#C8E6C9'; ctx.lineWidth = 1.5; ctx.stroke();

            ctx.fillStyle = '#2E7D32'; ctx.font = `bold 18px ${FONTE_PADRAO}`;
            ctx.fillText(`💰 Crédito aplicado: ${formatarMoeda(dados.credito)}`, margem + 20, yAtual + 30);

            ctx.fillStyle = '#555555'; ctx.font = `14px ${FONTE_PADRAO}`;
            ctx.fillText('ℹ️ Valores incluem Seguro Viagem opcional. Caso não deseje a cobertura, haverá uma', margem + 20, yAtual + 55);
            ctx.fillText('redução entre R$ 6,00 a R$ 16,00.', margem + 42, yAtual + 73);
            yAtual += 100;
        }

        dados.viagens.forEach((v) => {
            ctx.shadowColor = 'rgba(0,0,0,0.05)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
            ctx.fillStyle = '#FFFFFF';
            desenharCartao(ctx, margem, yAtual, largura - (margem * 2), alturaCartao, 10);
            ctx.shadowColor = 'transparent';

            ctx.fillStyle = '#333333'; ctx.font = `bold 20px ${FONTE_PADRAO}`;
            ctx.fillText(v.saida, margem + 25, yAtual + 40);

            ctx.fillStyle = '#888888'; ctx.font = `14px ${FONTE_PADRAO}`;
            ctx.fillText(`chegada ${v.chegada}`, margem + 25, yAtual + 65);

            ctx.fillStyle = '#EEEEEE'; ctx.fillRect(margem + 140, yAtual + 20, 2, 50);

            ctx.fillStyle = '#303F9F'; ctx.font = `600 16px ${FONTE_PADRAO}`;
            ctx.fillText(v.servico, margem + 165, yAtual + 40);

            ctx.fillStyle = '#666666'; ctx.font = `14px ${FONTE_PADRAO}`;
            ctx.fillText(`💺 ${v.textoPoltronas}`, margem + 165, yAtual + 65);

            ctx.fillStyle = '#EEEEEE'; ctx.fillRect(largura - margem - 280, yAtual + 20, 2, 50);

            ctx.textAlign = 'right';
            let prefixo = "";
            let valorEmDestaque = v.displayValor;

            if (v.displayValor.includes("R$")) {
                const partes = v.displayValor.split("R$");
                prefixo = partes[0].trim();
                valorEmDestaque = "R$ " + partes[1].trim();
            }

            if (prefixo !== "") {
                ctx.fillStyle = '#888888'; ctx.font = `13px ${FONTE_PADRAO}`;
                ctx.fillText(prefixo, largura - margem - 25, yAtual + 40);

                ctx.fillStyle = '#E65100'; ctx.font = `bold 22px ${FONTE_PADRAO}`;
                ctx.fillText(valorEmDestaque, largura - margem - 25, yAtual + 68);
            } else {
                ctx.fillStyle = '#E65100'; ctx.font = `bold 20px ${FONTE_PADRAO}`;
                ctx.fillText(valorEmDestaque, largura - margem - 25, yAtual + 55);
            }

            ctx.textAlign = 'left';
            yAtual += alturaCartao + espacoEntreCartoes;
        });

        canvas.toBlob(async function(blob) {
            try {
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                limparTudo();
                const btn = document.getElementById('btn-copy-william');
                btn.style.background = "#28a745"; btn.innerHTML = `✅ Card App Copiado!`;
                setTimeout(() => { btn.style.background = "#303F9F"; btn.innerHTML = "📸 Copiar Tabela (Imagem)"; }, 3000);
            } catch (err) { alert("Erro ao copiar."); }
        }, "image/png");
    }

    function extrairDados() {
        const credito = getCredito();
        const elementoData = document.querySelector('.service-date-title, #txt-data-ida-retorno, .active .date-value');
        let dataTexto = elementoData ? elementoData.innerText.trim().toUpperCase() : "DATA";
        dataTexto = dataTexto.replace('EM ', '').replace('COPIAR', '').trim();

        const trecho = capturarTrecho();
        const blocosHorario = document.querySelectorAll('.service-col-3');
        let viagens = [];

        blocosHorario.forEach(bloco => {
            const linha = bloco.closest('.service-row') || bloco.parentElement.parentElement;
            if (!linha) return;

            const b = bloco.querySelectorAll('b');
            const saida = b[0]?.innerText.trim() || "";
            const chegada = b[1]?.innerText.trim() || "";

            if (!saida) return;

            const servico = linha.querySelector('.spn-class')?.innerText.trim() || "CONVENCIONAL";
            const poltTxt = linha.querySelector('.service-availability, [class*="availability"]')?.innerText.replace(/[^0-9]/g, '') || "0";
            const polt = parseInt(poltTxt);

            if (polt <= 0) return;

            let valorNovo = 0;
            const celulas = linha.querySelectorAll('td, .price-family-container, .service-price-family');
            for (let c of celulas) {
                let txt = c.innerText.toUpperCase();
                if ((txt.includes('BRL') || txt.includes('R$')) && !txt.includes('INDISPONÍVEL') && !txt.includes('ESGOTADO')) {
                    valorNovo = extrairNumero(txt);
                    if (valorNovo > 0) break;
                }
            }

            if (valorNovo === 0) return;

            let displayValor = "";
            if (credito > 0) {
                let dif = valorNovo - credito;
                displayValor = dif <= 0.00 ? "ISENTO" : "Dif. a partir de R$ " + dif.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            } else {
                displayValor = "A partir de R$ " + valorNovo.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            }

            const textoPoltronas = polt === 1 ? "1 vaga" : `${polt} vagas`;
            viagens.push({ saida, chegada, servico, displayValor, textoPoltronas });
        });

        if (viagens.length > 0) {
            desenharECopiarImagem({ isRemarcacao: credito > 0, credito, dataTexto, trecho, viagens });
        } else {
            alert("Nenhum horário com vaga disponível encontrado.");
        }
    }

    function gerenciarBotao() {
        const temHorarios = document.querySelector('.service-col-3') !== null;
        const textoTela = document.body.innerText.toUpperCase();
        const isConfirmacao = (textoTela.includes('TIPO DA OPERAÇÃO') || textoTela.includes('TIPO DA OPERACAO')) && textoTela.includes('PASSAGEIRO');

        let btn = document.getElementById('btn-copy-william');

        if (temHorarios && !isConfirmacao) {
            if (!btn) {
                btn = document.createElement('button');
                btn.id = 'btn-copy-william';
                btn.innerHTML = '📸 Copiar Tabela (Imagem)';
                btn.style = "position:fixed; bottom:20px; right:20px; z-index:999999; padding:10px 18px; background:#303F9F; color:white; border:2px solid #fff; border-radius:8px; cursor:pointer; font-weight:bold; box-shadow:0 3px 10px rgba(0,0,0,0.25); font-size:14px;";
                document.body.appendChild(btn);
                btn.onclick = extrairDados;
            }
            btn.style.display = 'block';
        } else if (btn) {
            btn.style.display = 'none';
        }
    }

    setInterval(() => { gerenciarBotao(); capturarValorLiquido(); }, 1500);

})();

// =========================================================================
// SCRIPT 2: CARTÃO DE EMBARQUE DIGITAL
// =========================================================================
(function() {
    'use strict';

    const DICIONARIO_CIDADES = {
        "THE": "TERESINA", "PHB": "PARNAÍBA", "FOR": "FORTALEZA", "SLZ": "SÃO LUÍS",
        "PIC": "PICOS", "FLR": "FLORIANO", "SOB": "SOBRAL", "CJP": "CAJUEIRO DA PRAIA",
        "LCR": "LUÍS CORREIA", "NAT": "NATAL", "REC": "RECIFE", "JPA": "JOÃO PESSOA",
        "MCZ": "MACEIÓ", "AJU": "ARACAJU", "SSA": "SALVADOR", "BEL": "BELÉM",
        "IMP": "IMPERATRIZ", "PNZ": "PETROLINA", "JDO": "JUAZEIRO DO NORTE",
        "CMP": "CAMPO MAIOR", "PIR": "PIRIPIRI", "MOS": "MOSSORÓ", "TBA": "TIANGUÁ",
        "CCM": "CAMOCIM", "CANGA": "RECIFE (CAXANGA)"
    };

    function desenharRetanguloArredondado(ctx, x, y, width, height, radius, fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath(); ctx.fill();
    }

    function limparCidade(nome) {
        let limpo = nome.replace(/^[A-Z]+\s*-\s*/i, '')
                        .replace(/\s*-\s*[A-Z]{2}$/i, '')
                        .replace(/\s*\(.*?\)/g, '')
                        .trim();
        if (limpo.length === 3) return DICIONARIO_CIDADES[limpo.toUpperCase()] || limpo;
        return limpo;
    }

    function espionarTrechosCompletos() {
        try {
            let origem = document.querySelector('#txt-origem')?.value || "";
            let destino = document.querySelector('#txt-destino')?.value || "";
            if (!origem || !destino) {
                const textoTopo = document.body.innerText.substring(0, 1500);
                const match = textoTopo.match(/de\s+(.*)\s+para\s+(.*?)(?:\n|em |$)/i);
                if (match) { origem = match[1].trim(); destino = match[2].trim(); }
            }
            if (origem && destino) {
                origem = origem.replace(/\s*-\s*[A-Z]{2}$/i, '').replace(/^[A-Z]{3}\s*-\s*/i, '').trim().toUpperCase();
                destino = destino.replace(/\s*-\s*[A-Z]{2}$/i, '').replace(/^[A-Z]{3}\s*-\s*/i, '').trim().toUpperCase();
                if (origem.length > 2 && destino.length > 2) {
                    sessionStorage.setItem("william_cidades_longas", JSON.stringify({origem, destino}));
                }
            }
        } catch (erro) {}
    }

    function capturarDadosConfirmacao() {
        let reserva = { tipo: "CONFERÊNCIA DE REMARCAÇÃO", origem: "---", destino: "---", data: "---", horario: "---", passageiro: "---", servico: "CONVENCIONAL", poltrona: "--" };
        let textoAchatado = document.body.innerText.replace(/\s+/g, ' ').toUpperCase();

        let mData = textoAchatado.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (mData) reserva.data = mData[1];
        let mHora = textoAchatado.match(/(\d{2}:\d{2})\s*(?:-|ÀS|ATÉ)\s*(\d{2}:\d{2})/);
        if (mHora) reserva.horario = `${mHora[1]} às ${mHora[2]}`;

        // CORREÇÃO: Lista expandida para reconhecer tarifas jovens, infantis, etc.
        let mNome = textoAchatado.match(/#\d+\s+([A-ZÀ-ÖØ-öø-ÿ\s]+?)\s+(?:NORMAL|PASSE LIVRE|IDOSO|ESTUDANTE|BPE|ID JOVEM|JOVEM|CRIANÇA|CRIANCA|INFANTIL|GRATUIDADE|CORTESIA|FUNCIONARIO|RG|CPF|BRL|R\$)/);
        if (mNome) reserva.passageiro = mNome[1].trim();

        let mTrecho = textoAchatado.match(/\b([A-Z]{2,12})\b\s*(?:->|➔|→|>)?\s*\b([A-Z]{2,12})\b\s*\(([^()]{2,40})\)\s*(\d{1,3})\b/);
        if (mTrecho) {
            reserva.origem = mTrecho[1]; reserva.destino = mTrecho[2];
            reserva.servico = mTrecho[3].replace(/[^A-Z\s\+]/g, '').trim();
            reserva.poltrona = mTrecho[4];
        } else {
            let mTrechoIsolado = textoAchatado.match(/\b([A-Z]{2,12})\b\s*(?:->|➔|→|>)?\s*\b([A-Z]{2,12})\b\s*\(([^()]{2,40})\)/);
            if (mTrechoIsolado) {
                reserva.origem = mTrechoIsolado[1]; reserva.destino = mTrechoIsolado[2];
                reserva.servico = mTrechoIsolado[3].replace(/[^A-Z\s\+]/g, '').trim();
                let pos = textoAchatado.indexOf(mTrechoIsolado[0]);
                let textoRestante = textoAchatado.substring(pos + mTrechoIsolado[0].length).trim();
                let mPoltronaGarante = textoRestante.match(/^(\d{1,3})\b/);
                if(mPoltronaGarante) reserva.poltrona = mPoltronaGarante[1];
            }
        }

        if (reserva.servico.length > 35 || reserva.servico.length < 2) {
            if (textoAchatado.includes('SEMI LEITO')) reserva.servico = 'SEMI LEITO';
            else if (textoAchatado.includes('LEITO')) reserva.servico = 'LEITO';
            else if (textoAchatado.includes('EXECUTIVO')) reserva.servico = 'EXECUTIVO';
            else reserva.servico = 'CONVENCIONAL';
        }

        reserva.origem = limparCidade(reserva.origem);
        reserva.destino = limparCidade(reserva.destino);

        try {
            let trechosMemoria = sessionStorage.getItem("william_cidades_longas");
            if (trechosMemoria) {
                let dadosSalvos = JSON.parse(trechosMemoria);
                if (dadosSalvos.origem && dadosSalvos.origem.length > 3) reserva.origem = limparCidade(dadosSalvos.origem);
                if (dadosSalvos.destino && dadosSalvos.destino.length > 3) reserva.destino = limparCidade(dadosSalvos.destino);
            }
        } catch(e){}

        return reserva;
    }

    async function gerarImagemCartao(reserva) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const largura = 850;
        const altura = 460;
        const margem = 30;
        canvas.width = largura; canvas.height = altura;

        ctx.fillStyle = '#F4F6F8'; ctx.fillRect(0, 0, largura, altura);
        ctx.fillStyle = '#303F9F'; ctx.fillRect(0, 0, largura, 90);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 22px ${FONTE_PADRAO}`;
        ctx.fillText(`🔄 ${reserva.tipo}`, margem, 55);

        let yAtual = 115;

        ctx.shadowColor = 'rgba(0,0,0,0.05)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        desenharRetanguloArredondado(ctx, margem, yAtual, largura - (margem * 2), 65, 8, '#FFF3F3');
        ctx.shadowColor = 'transparent';

        ctx.strokeStyle = '#FFCDD2'; ctx.lineWidth = 1.5;
        ctx.strokeRect(margem, yAtual, largura - (margem * 2), 65);

        ctx.fillStyle = '#B71C1C'; ctx.textAlign = 'center';
        ctx.font = `bold 14px ${FONTE_PADRAO}`;
        ctx.fillText("⚠️ ATENÇÃO: Verifique os dados abaixo.", largura / 2, yAtual + 28);
        ctx.font = `14px ${FONTE_PADRAO}`;
        ctx.fillText("O bilhete final será gerado somente após a sua confirmação.", largura / 2, yAtual + 48);

        yAtual += 80;

        ctx.shadowColor = 'rgba(0,0,0,0.05)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
        desenharRetanguloArredondado(ctx, margem, yAtual, largura - (margem * 2), 130, 10, '#FFFFFF');
        ctx.shadowColor = 'transparent';

        ctx.textAlign = 'left';
        ctx.fillStyle = '#888888'; ctx.font = `12px ${FONTE_PADRAO}`;
        ctx.fillText('PASSAGEIRO', margem + 25, yAtual + 28);
        ctx.fillStyle = '#333333'; ctx.font = `bold 20px ${FONTE_PADRAO}`;
        let nomeVisual = reserva.passageiro.length > 45 ? reserva.passageiro.substring(0, 45) + "..." : reserva.passageiro;
        ctx.fillText(nomeVisual, margem + 25, yAtual + 52);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#888888'; ctx.font = `12px ${FONTE_PADRAO}`;
        ctx.fillText('CLASSE', largura - margem - 25, yAtual + 28);

        let fontServico = 18;
        ctx.font = `bold ${fontServico}px ${FONTE_PADRAO}`;
        let maxLarguraServico = 280;
        while(ctx.measureText(reserva.servico).width > maxLarguraServico && fontServico > 11) {
            fontServico--;
            ctx.font = `bold ${fontServico}px ${FONTE_PADRAO}`;
        }

        ctx.fillStyle = '#E65100';
        ctx.fillText(reserva.servico, largura - margem - 25, yAtual + 52);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#EEEEEE'; ctx.fillRect(margem + 20, yAtual + 70, largura - (margem * 2) - 40, 1.5);

        ctx.fillStyle = '#303F9F';
        let textoItin = `${reserva.origem}  ➔  ${reserva.destino}`;
        let tamFonte = textoItin.length > 35 ? 20 : 24;
        ctx.font = `bold ${tamFonte}px ${FONTE_PADRAO}`;
        ctx.fillText(textoItin, margem + 25, yAtual + 105);

        yAtual += 145;

        ctx.shadowColor = 'rgba(0,0,0,0.05)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
        desenharRetanguloArredondado(ctx, margem, yAtual, largura - (margem * 2), 90, 10, '#FFFFFF');
        ctx.shadowColor = 'transparent';

        ctx.fillStyle = '#888888'; ctx.font = `12px ${FONTE_PADRAO}`; ctx.fillText('DATA', margem + 25, yAtual + 35);
        ctx.fillStyle = '#333333'; ctx.font = `bold 20px ${FONTE_PADRAO}`; ctx.fillText(`📅 ${reserva.data}`, margem + 25, yAtual + 62);

        ctx.fillStyle = '#EEEEEE'; ctx.fillRect(margem + 230, yAtual + 20, 2, 50);

        ctx.fillStyle = '#888888'; ctx.font = `12px ${FONTE_PADRAO}`; ctx.fillText('HORÁRIO', margem + 260, yAtual + 35);
        ctx.fillStyle = '#333333'; ctx.font = `bold 20px ${FONTE_PADRAO}`; ctx.fillText(`⏱️ ${reserva.horario}`, margem + 260, yAtual + 62);

        ctx.fillStyle = '#E8F5E9';
        let boxPW = 130; let boxPX = largura - margem - boxPW - 20; let boxPY = yAtual + 12;
        desenharRetanguloArredondado(ctx, boxPX, boxPY, boxPW, 66, 8, '#E8F5E9');
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2E7D32'; ctx.font = `bold 12px ${FONTE_PADRAO}`; ctx.fillText('POLTRONA', boxPX + (boxPW/2), boxPY + 22);
        ctx.font = `bold 30px ${FONTE_PADRAO}`; ctx.fillText(reserva.poltrona, boxPX + (boxPW/2), boxPY + 52);
        ctx.textAlign = 'left';

        canvas.toBlob(async function(blob) {
            try {
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                const btn = document.getElementById('btn-bilhete-william');
                btn.style.background = "#28a745"; btn.innerHTML = `✅ Bilhete Premium Copiado!`;
                setTimeout(() => { btn.style.background = "#303F9F"; btn.innerHTML = "📸 Gerar Prévia de Remarcação"; }, 3000);
            } catch (err) { alert("Erro ao copiar para a área de transferência."); }
        }, "image/png");
    }

    function adicionarDrag(btn) {
        let isDragging = false; let dragStartX, dragStartY;
        btn.onmousedown = function(e) {
            isDragging = false; dragStartX = e.clientX; dragStartY = e.clientY;
            let shiftX = e.clientX - btn.getBoundingClientRect().left;
            let shiftY = e.clientY - btn.getBoundingClientRect().top;
            function moveAt(pageX, pageY) { btn.style.bottom = 'auto'; btn.style.right = 'auto'; btn.style.left = pageX - shiftX + 'px'; btn.style.top = pageY - shiftY + 'px'; }
            function onMouseMove(e) { if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) { isDragging = true; moveAt(e.clientX, e.clientY); } }
            document.addEventListener('mousemove', onMouseMove);
            document.onmouseup = function() { document.removeEventListener('mousemove', onMouseMove); document.onmouseup = null; };
        };
        btn.onclick = function(e) { if (isDragging) return; btn.innerHTML = "⌛ Gerando..."; gerarImagemCartao(capturarDadosConfirmacao()); };
    }

    function iniciar() {
        espionarTrechosCompletos();

        const textoTela = document.body.innerText.toUpperCase();

        const isRemarcacao = (textoTela.includes('TIPO DA OPERAÇÃO') || textoTela.includes('TIPO DA OPERACAO')) && textoTela.includes('PASSAGEIRO');

        let btn = document.getElementById('btn-bilhete-william');

        if (isRemarcacao) {
            if (!btn) {
                btn = document.createElement('button');
                btn.id = 'btn-bilhete-william';
                btn.innerHTML = '📸 Gerar Prévia de Remarcação';
                btn.style = "position:fixed; bottom:20px; right:20px; z-index:999999; padding:10px 18px; background:#303F9F; color:white; border:2px solid #fff; border-radius:8px; font-weight:bold; box-shadow:0 3px 10px rgba(0,0,0,0.25); font-size:14px; cursor:grab;";
                document.body.appendChild(btn);
                adicionarDrag(btn);
            }
        } else if (btn) {
            btn.remove();
        }
    }

    setInterval(iniciar, 1500);

})();
