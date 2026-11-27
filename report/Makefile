# 编译本目录下的报告模板（XeLaTeX，需编译两遍以生成目录与交叉引用）
XELATEX ?= xelatex

.PHONY: all clean

all: report-template.pdf individual-template.pdf

%.pdf: %.tex
	$(XELATEX) -interaction=nonstopmode $<
	$(XELATEX) -interaction=nonstopmode $<

clean:
	rm -f *.aux *.log *.out *.toc *.synctex.gz
