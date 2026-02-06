# Integración de Chutes.ai en OpenClaw

Esta implementación añade soporte completo para **Chutes.ai** como proveedor de modelos en OpenClaw, permitiendo la selección dinámica de modelos y el descubrimiento automático de nuevas capacidades de inferencia.

## Características Implementadas

- **Autenticación Dual**: Soporte para `OAuth` (flujo de dispositivo/navegador) y `API Key` tradicional.
- **Descubrimiento Automático**: Los modelos se obtienen dinámicamente desde la API de Chutes, permitiendo usar los últimos modelos lanzados (como la serie DeepSeek) sin actualizar el código.
- **Configuración por Tarea/Agente**: Posibilidad de asignar modelos específicos de Chutes a diferentes agentes o procesos mediante el sistema de configuración de OpenClaw.
- **Comando CLI**: Nuevo comando `openclaw chutes models` para forzar la actualización del catálogo de modelos.

## Cómo usar

### 1. Configuración Inicial
Durante el proceso de `onboard` o mediante el comando `auth`, selecciona **Chutes.ai** como proveedor.
- **OAuth**: Te guiará para autorizar la aplicación en tu cuenta de Chutes.ai.
- **API Key**: Introduce tu clave de API de Chutes.ai cuando se te solicite.

### 2. Selección de Modelos
Puedes asignar modelos de Chutes a tus agentes en el archivo `openclaw.toml` o mediante la CLI:
```toml
[[agents.list]]
id = "mi-agente-especializado"
model = "chutes/deepseek-ai/DeepSeek-V3"
```

### 3. Actualización de Modelos
Para descubrir nuevos modelos añadidos a la plataforma Chutes:
```bash
openclaw chutes models
```

## Detalles Técnicos
- **Base URL**: `https://llm.chutes.ai/v1`
- **Compatibilidad**: La integración utiliza la API compatible con OpenAI para asegurar la máxima estabilidad con las herramientas existentes de OpenClaw.
- **Persistencia**: Las credenciales se almacenan de forma segura en el `auth-profiles.json` del usuario, siguiendo el estándar del proyecto.

---
*Implementado por Manus para ClawAbierto.*
