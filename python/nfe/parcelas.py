"""Geração de parcelas: usa as duplicatas da NF ou, sem elas, a premissa da conta."""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from .leitor_xml import NotaFiscal


@dataclass
class Premissa:
    regra: str = "dias_corridos"  # dias_corridos | dia_fixo_mes_seguinte | a_vista
    prazos_dias: tuple[int, ...] = (30,)
    dia_fixo: int | None = None


@dataclass
class Parcela:
    numero: int
    vencimento: date
    valor: Decimal


def _dia_fixo(base: date, meses_a_frente: int, dia: int) -> date:
    mes = base.month - 1 + meses_a_frente
    ano, mes = base.year + mes // 12, mes % 12 + 1
    return date(ano, mes, min(dia, calendar.monthrange(ano, mes)[1]))


def parcelas_pela_premissa(valor: Decimal, data_base: date, premissa: Premissa) -> list[Parcela]:
    if premissa.regra == "a_vista":
        return [Parcela(1, data_base, valor)]

    if premissa.regra == "dia_fixo_mes_seguinte":
        if not premissa.dia_fixo:
            raise ValueError("Premissa de dia fixo sem o dia informado")
        n = len(premissa.prazos_dias) or 1
        vencimentos = [_dia_fixo(data_base, i + 1, premissa.dia_fixo) for i in range(n)]
    else:
        vencimentos = [data_base + timedelta(days=d) for d in premissa.prazos_dias]

    # divide em partes iguais; a diferença de centavos fica na última parcela
    parte = (valor / len(vencimentos)).quantize(Decimal("0.01"), ROUND_HALF_UP)
    valores = [parte] * (len(vencimentos) - 1)
    valores.append(valor - sum(valores, Decimal("0")))
    return [Parcela(i + 1, v, x) for i, (v, x) in enumerate(zip(vencimentos, valores))]


def parcelas_da_nota(nota: NotaFiscal, premissa: Premissa) -> list[Parcela]:
    if nota.duplicatas:
        return [Parcela(i + 1, d.vencimento, d.valor) for i, d in enumerate(nota.duplicatas)]
    return parcelas_pela_premissa(nota.valor_total, nota.data_emissao, premissa)
