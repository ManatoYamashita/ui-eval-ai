# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UI Evaluation AI is a Next.js web application that analyzes design images using AI and provides professional improvement suggestions based on authoritative design guidelines (WCAG, Apple HIG, Refactoring UI). The system uses Google Gemini 1.5 Flash for image analysis and Google Text Embedding 004 for vector search, achieving 95% cost reduction compared to traditional AI services.

### Key Features
- **AI Image Analysis**: Google Gemini 1.5 Flash analyzes UI elements and design patterns
- **Hybrid Search**: Vector search + full-text search for relevant design guidelines
- **Multi-layer Fallback**: 6-level fallback system ensuring 99%+ availability
- **Practical Suggestions**: Improvement proposals with TailwindCSS code examples
- **Cost Optimization**: $7.5/month for 100 analyses (vs $150 with traditional APIs)

## Development Commands

### Essential Commands
```bash
# Development
npm run dev                 # Start development server (http://localhost:3000)
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Run ESLint

# Database Setup & Management
npm run setup-db           # Test API keys and database connection
npm run check-db           # Check database and function status
npm run test-apis          # Test all API endpoints

# Knowledge Base Management
npm run expand-knowledge   # Add 18 additional design guidelines
npm run add-guidelines     # Add custom guidelines interactively
```

### Testing & Verification
```bash
# API Testing
npm run test-apis          # Test Google AI APIs and database functions

# Database Status
npm run check-db           # Verify database functions and table status

# Manual Testing
# Visit http://localhost:3000 and upload a design image
```

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL + pgvector), Next.js API routes
- **AI Services**: Google Gemini 1.5 Flash, Google Text Embedding 004
- **Database**: PostgreSQL with pgvector extension for vector search

### Core System Flow
1. **Image Upload**: User uploads design image with natural language question
2. **Element Detection**: AI identifies UI elements (buttons, text, layout, etc.)
3. **Guideline Search**: Hybrid search (vector + full-text) finds relevant guidelines
4. **Analysis**: AI analyzes image against retrieved guidelines
5. **Response**: Structured improvement suggestions with TailwindCSS code examples

### Multi-layer Fallback System
The system implements 6 levels of fallback to ensure high availability:
1. **Hybrid Search**: Vector + full-text search (optimal)
2. **Text-only Search**: When embedding generation fails
3. **Manual Keyword Search**: When database functions don't exist
4. **Basic Category Search**: Simple category-based retrieval
5. **Guideline-based Analysis**: AI analysis without vector search
6. **Hardcoded Suggestions**: Static improvement suggestions as final fallback

## File Structure & Key Components

### Core Analysis Pipeline
- `app/api/analyze/route.ts` - Main analysis API endpoint
- `app/lib/ai-analysis.ts` - AI image analysis orchestration
- `app/lib/rag-search.ts` - Multi-layer search system implementation
- `app/lib/ai-clients.ts` - Google AI API clients (Gemini, Embeddings)
- `app/lib/prompt-engineering.ts` - Dynamic prompt generation

### Database & Knowledge Base
- `supabase/migrations/001_initial_schema.sql` - Database schema
- `supabase/functions/hybrid_search.sql` - Vector + text search function
- `supabase/functions/keyword_search.sql` - Keyword search function
- `scripts/setup-knowledge-base.ts` - Initial 10 guidelines setup
- `scripts/expand-knowledge-base.ts` - Additional 18 guidelines

### UI Components
- `app/components/ui/FileUpload.tsx` - Drag & drop image upload
- `app/components/ui/AnalysisResult.tsx` - Structured result display
- `app/components/ui/LoadingSpinner.tsx` - Loading states
- `app/page.tsx` - Main application interface

## Development Guidelines

### Code Quality Standards
- **TypeScript**: Strict mode enabled, avoid `any` types
- **Error Handling**: Comprehensive try-catch blocks with fallbacks
- **API Design**: RESTful endpoints with structured responses
- **Component Design**: Functional components with hooks, atomic design patterns

### Architecture Principles
- **Resilience**: Multiple fallback layers for all external dependencies
- **Performance**: Optimized for 8-10 second response times
- **Modularity**: Clear separation between AI, search, and UI layers
- **Extensibility**: Easy to add new design guidelines and AI models

### Environment Configuration
Key environment variables (see `.env.local.example`):
```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google AI (Required)
GOOGLE_GENAI_API_KEY=your_google_gemini_api_key

# Optional Configuration
MAX_FILE_SIZE=10485760                    # 10MB file upload limit
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp
```

## Database Schema

### Main Table: design_guidelines
```sql
- id: BIGSERIAL PRIMARY KEY
- content: TEXT (guideline content)
- source: VARCHAR(100) (WCAG, Apple HIG, Refactoring UI)
- category: VARCHAR(50) (accessibility, usability, visual_design)
- subcategory: VARCHAR(100) (color_contrast, touch_targets, etc.)
- embedding: VECTOR(768) (Google Text Embedding 004)
- keywords: TEXT[] (search keywords)
- metadata: JSONB (additional information)
```

### Critical Database Functions
- `hybrid_search()` - Vector + full-text search
- `hybrid_search_by_category()` - Category-filtered hybrid search
- `search_by_keywords()` - Keyword-based search
- `keyword_search()` - Advanced keyword matching

**Note**: If database functions don't exist, the system automatically falls back to client-side search methods.

## Development Workflow

### Setting Up Development Environment
1. Clone repository and install dependencies: `npm install`
2. Copy environment variables: `cp .env.local.example .env.local`
3. Configure Supabase and Google AI API keys
4. Setup knowledge base: `npm run setup-db`
5. Start development server: `npm run dev`

### Adding New Design Guidelines
1. Use interactive script: `npm run add-guidelines`
2. Or expand existing base: `npm run expand-knowledge`
3. Verify with: `npm run check-db`

### Testing the System
1. Start development server: `npm run dev`
2. Upload test image at http://localhost:3000
3. Test various prompts (accessibility, usability, visual design)
4. Verify API responses: `npm run test-apis`

## Common Issues & Solutions

### Database Function Errors
**Issue**: `Could not find the function hybrid_search`
**Solution**: 
1. Go to Supabase Dashboard → SQL Editor
2. Execute functions from `supabase/functions/` directory
3. Run `npm run check-db` to verify

### API Response Timeouts
**Issue**: Analysis takes >15 seconds
**Solution**: Database functions likely missing, causing fallback to slower methods

### Low Analysis Quality
**Issue**: Generic suggestions without specific guidelines
**Solution**: Run `npm run expand-knowledge` to add more comprehensive guidelines

## Performance Optimization

### Current Metrics
- **Response Time**: 8-10 seconds (target), 13-15 seconds (current without DB functions)
- **Success Rate**: 99%+ (multi-layer fallback)
- **Cost Efficiency**: 95% reduction vs traditional AI APIs

### Optimization Recommendations
1. **Create Database Functions**: Implement PostgreSQL functions for faster search
2. **Expand Knowledge Base**: Add more specific guidelines for better accuracy
3. **Implement Caching**: Cache embeddings and frequent queries
4. **Optimize Prompts**: Fine-tune prompts for better AI responses

## Cursor Rules Integration

This project follows specific development principles defined in `.cursor/rules/`:
- **TypeScript Standards**: Strict typing, no `any` usage
- **Error Handling**: Comprehensive fallback systems
- **UI/UX Standards**: Accessible, responsive design
- **Documentation**: Keep dev.md updated with implementation changes

## Debugging & Monitoring

### Logging Strategy
- Console logs are structured with emoji prefixes for easy identification
- Error logs include full stack traces and fallback actions
- Performance metrics are logged for each analysis step

### Key Log Patterns
```
🖼️ Processing image...          # Image upload & processing
🔍 Starting hybrid search...     # Search operations
🧠 Performing analysis...        # AI analysis
✅ Analysis completed...         # Success states
❌ [Component] error...          # Error states
🔄 Falling back to...           # Fallback actions
```

This system is designed to be resilient, cost-effective, and provide high-quality design analysis. The multi-layer fallback system ensures consistent operation even when external services fail.