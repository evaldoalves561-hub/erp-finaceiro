"""Leitura do XML da NF-e (modelo 55) para o formato usado pelo ERP."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

NS = {"n": "http://www.portalfiscal.inf.br/nfe"}


@dataclass
class ItemNF:
    numero: int
    codigo_fornecedor: str
    descricao: str
    ncm: str | None
    cfop: str | None
    unidade: str | None
    quantidade: Decimal
    valor_unitario: Decimal
    valor_total: Decimal


@dataclass
class Duplicata:
    numero: str | None
    vencimento: date
    valor: Decimal


@dataclass
class NotaFiscal:
    chave_acesso: str
    numero: str
    serie: str
    data_emissao: date
    emitente_cnpj: str
    emitente_nome: str
    destinatario_cnpj: str | None
    valor_total: Decimal
    itens: list[ItemNF] = field(default_factory=list)
    duplicatas: list[Duplicata] = field(default_factory=list)


def _txt(no: ET.Element | None, caminho: str) -> str | None:
    if no is None:
        return None
    achado = no.find(caminho, NS)
    return achado.text.strip() if achado is not None and achado.text else None


def _dec(valor: str | None) -> Decimal:
    return Decimal(valor) if valor else Decimal("0")


def ler_nfe(conteudo: bytes | str) -> NotaFiscal:
    """Recebe o XML (nfeProc ou NFe) e devolve a nota estruturada."""
    raiz = ET.fromstring(conteudo)
    inf = raiz.find(".//n:infNFe", NS)
    if inf is None:
        raise ValueError("XML não é uma NF-e: tag infNFe não encontrada")

    chave = (inf.get("Id") or "").removeprefix("NFe")
    if len(chave) != 44 or not chave.isdigit():
        raise ValueError(f"Chave de acesso inválida: {chave!r}")

    ide = inf.find("n:ide", NS)
    emit = inf.find("n:emit", NS)
    dest = inf.find("n:dest", NS)
    emissao = _txt(ide, "n:dhEmi") or _txt(ide, "n:dEmi")

    nota = NotaFiscal(
        chave_acesso=chave,
        numero=_txt(ide, "n:nNF") or "",
        serie=_txt(ide, "n:serie") or "",
        data_emissao=date.fromisoformat(emissao[:10]),
        emitente_cnpj=_txt(emit, "n:CNPJ") or _txt(emit, "n:CPF") or "",
        emitente_nome=_txt(emit, "n:xNome") or "",
        destinatario_cnpj=_txt(dest, "n:CNPJ") or _txt(dest, "n:CPF"),
        valor_total=_dec(_txt(inf, "n:total/n:ICMSTot/n:vNF")),
    )

    for det in inf.findall("n:det", NS):
        prod = det.find("n:prod", NS)
        nota.itens.append(ItemNF(
            numero=int(det.get("nItem", "0")),
            codigo_fornecedor=_txt(prod, "n:cProd") or "",
            descricao=_txt(prod, "n:xProd") or "",
            ncm=_txt(prod, "n:NCM"),
            cfop=_txt(prod, "n:CFOP"),
            unidade=_txt(prod, "n:uCom"),
            quantidade=_dec(_txt(prod, "n:qCom")),
            valor_unitario=_dec(_txt(prod, "n:vUnCom")),
            valor_total=_dec(_txt(prod, "n:vProd")),
        ))

    for dup in inf.findall("n:cobr/n:dup", NS):
        nota.duplicatas.append(Duplicata(
            numero=_txt(dup, "n:nDup"),
            vencimento=date.fromisoformat(_txt(dup, "n:dVenc")),
            valor=_dec(_txt(dup, "n:vDup")),
        ))

    return nota
