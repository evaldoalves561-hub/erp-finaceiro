import unittest
from dataclasses import replace
from datetime import date
from decimal import Decimal
from pathlib import Path

from nfe.leitor_xml import ler_nfe
from nfe.parcelas import Premissa, parcelas_da_nota, parcelas_pela_premissa

XML = (Path(__file__).parent / "nfe_exemplo.xml").read_bytes()


class TestLeitorXml(unittest.TestCase):
    def test_cabecalho_itens_e_duplicatas(self):
        nota = ler_nfe(XML)
        self.assertEqual(nota.chave_acesso, "35261011222333000181550010000012341000012345")
        self.assertEqual(nota.numero, "1234")
        self.assertEqual(nota.data_emissao, date(2026, 10, 15))
        self.assertEqual(nota.emitente_cnpj, "11222333000181")
        self.assertEqual(nota.destinatario_cnpj, "44555666000199")
        self.assertEqual(nota.valor_total, Decimal("400.00"))
        self.assertEqual([i.quantidade for i in nota.itens], [Decimal("100.0000"), Decimal("20.0000")])
        self.assertEqual(sum(i.valor_total for i in nota.itens), nota.valor_total)
        self.assertEqual([d.vencimento for d in nota.duplicatas], [date(2026, 11, 14), date(2026, 12, 14)])

    def test_xml_que_nao_e_nfe(self):
        with self.assertRaises(ValueError):
            ler_nfe("<foo/>")


class TestParcelas(unittest.TestCase):
    def test_usa_duplicatas_da_nota(self):
        parcelas = parcelas_da_nota(ler_nfe(XML), Premissa(prazos_dias=(10,)))
        self.assertEqual([(p.vencimento, p.valor) for p in parcelas],
                         [(date(2026, 11, 14), Decimal("200.00")), (date(2026, 12, 14), Decimal("200.00"))])

    def test_sem_duplicatas_aplica_premissa_30_60_90(self):
        nota = replace(ler_nfe(XML), duplicatas=[], valor_total=Decimal("100.00"))
        parcelas = parcelas_da_nota(nota, Premissa(prazos_dias=(30, 60, 90)))
        self.assertEqual([p.vencimento for p in parcelas], [date(2026, 11, 14), date(2026, 12, 14), date(2027, 1, 13)])
        self.assertEqual([p.valor for p in parcelas], [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")])

    def test_dia_fixo_ajusta_fim_de_mes(self):
        parcelas = parcelas_pela_premissa(Decimal("90"), date(2027, 1, 31),
                                          Premissa(regra="dia_fixo_mes_seguinte", prazos_dias=(0, 0), dia_fixo=31))
        self.assertEqual([p.vencimento for p in parcelas], [date(2027, 2, 28), date(2027, 3, 31)])

    def test_a_vista(self):
        parcelas = parcelas_pela_premissa(Decimal("50"), date(2026, 10, 1), Premissa(regra="a_vista"))
        self.assertEqual(len(parcelas), 1)
        self.assertEqual(parcelas[0].vencimento, date(2026, 10, 1))


if __name__ == "__main__":
    unittest.main()
