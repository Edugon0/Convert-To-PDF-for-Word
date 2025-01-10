// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const docx = require('docx');
const { Document, Paragraph, TextRun } = docx;

const app = express();
app.use(cors());

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const fileFilter = (req, file, cb) => {
    // Aceitar apenas arquivos PDF
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Formato não suportado. Por favor, envie um arquivo PDF.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Limite de 10MB
    }
});

// Criar pasta de uploads se não existir
const createUploadsFolder = async () => {
    try {
        await fs.access('uploads');
    } catch {
        await fs.mkdir('uploads');
    }
};

// Função para converter PDF para DOCX
async function convertPDFToWord(pdfPath) {
    try {
        // Ler o arquivo PDF
        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfData = await pdfParse(pdfBuffer);

        // Criar novo documento Word
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: pdfData.text,
                                size: 24 // 12pt
                            })
                        ]
                    })
                ]
            }]
        });

        // Gerar arquivo Word
        const buffer = await docx.Packer.toBuffer(doc);
        return buffer;
    } catch (error) {
        console.error('Erro na conversão:', error);
        throw error;
    }
}

// Rota para converter PDF para Word
app.post('/convert', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('Nenhum arquivo enviado');
        }

        const inputPath = req.file.path;
        
        // Converter PDF para Word
        const wordBuffer = await convertPDFToWord(inputPath);

        // Limpar arquivo original
        await fs.unlink(inputPath);

        // Enviar arquivo Word
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename=converted.docx');
        res.send(wordBuffer);

    } catch (error) {
        console.error('Erro:', error);
        res.status(500).send('Erro ao converter arquivo');
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await createUploadsFolder();
    console.log(`Servidor rodando na porta ${PORT}`);
});