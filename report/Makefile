# 编译小组报告模板（XeLaTeX，需编译两遍以生成目录与交叉引用）
XELATEX ?= xelatex

.PHONY: all clean

all: report-template.pdf

%.pdf: %.tex
	$(XELATEX) -interaction=nonstopmode $<
	$(XELATEX) -interaction=nonstopmode $<

clean:
	rm -f *.aux *.log *.out *.toc *.synctex.gz
