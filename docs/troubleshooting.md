# ScreenScore Troubleshooting Guide

> **License & Privacy:** ScreenScore is GPLv3-licensed, privacy-first, and all analysis is performed locally—no data leaves your machine.

This guide provides solutions for common issues you might encounter while using ScreenScore.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Ollama Issues](#ollama-issues)
3. [File Upload Issues](#file-upload-issues)
4. [Analysis Issues](#analysis-issues)
5. [Export Issues](#export-issues)
6. [Performance Issues](#performance-issues)

## Installation Issues

### Node.js Installation

**Issue**: Node.js installation fails or version is incorrect.

**Solution**:
1. Ensure you have Node.js v18 or later:
   ```bash
   node --version
   ```
2. If version is incorrect, install the correct version:
   - Visit [Node.js website](https://nodejs.org)
   - Download and install the LTS version
   - Restart your terminal

### Dependencies Installation

**Issue**: `npm install` fails.

**Solution**:
1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```
2. Delete node_modules and package-lock.json:
   ```bash
   rm -rf node_modules package-lock.json
   ```
3. Reinstall dependencies:
   ```bash
   npm install
   ```

## Ollama Issues

### Ollama Not Running

**Issue**: Ollama service is not running.

**Solution**:
1. Check Ollama status:
   ```bash
   ollama list
   ```
2. Start Ollama:
   ```bash
   ollama run mistral:7b-instruct-q4_K_M
   ```

### Model Not Found

**Issue**: Mistral model is not available.

**Solution**:
1. Pull the model:
   ```bash
   ollama pull mistral:7b-instruct-q4_K_M
   ```
2. Verify model is available:
   ```bash
   ollama list
   ```

### Ollama Connection Issues

**Issue**: Cannot connect to Ollama API.

**Solution**:
1. Check if Ollama is running on port 11434
2. Verify firewall settings
3. Restart Ollama service

## File Upload Issues

### File Size Too Large

**Issue**: File upload fails due to size limit.

**Solution**:
1. Check file size (max 10MB)
2. Compress PDF if possible
3. Split large files if necessary

### Invalid File Format

**Issue**: File format not supported.

**Solution**:
1. Ensure file is PDF or TXT
2. Convert file to supported format
3. Check file is not corrupted

### Upload Progress Issues

**Issue**: Upload progress not showing or stuck.

**Solution**:
1. Check internet connection
2. Clear browser cache
3. Try different browser
4. Check server logs

## Analysis Issues

### Analysis Timeout

**Issue**: Analysis takes too long or times out.

**Solution**:
1. Check Ollama status
2. Verify file content
3. Try smaller file
4. Check server resources

### Invalid Analysis Results

**Issue**: Analysis results are incorrect or incomplete.

**Solution**:
1. Check file format
2. Verify file content
3. Try different file
4. Check Ollama logs

### Analysis Errors

**Issue**: Analysis fails with error.

**Solution**:
1. Check error message
2. Verify file format
3. Check server logs
4. Try different file

## Export Issues

### PDF Export Fails

**Issue**: PDF export fails or creates invalid file.

**Solution**:
1. Check file permissions
2. Verify analysis results
3. Try different export format
4. Check browser console

### Markdown Export Issues

**Issue**: Markdown export fails or creates invalid file.

**Solution**:
1. Check file permissions
2. Verify analysis results
3. Try different export format
4. Check browser console

## Performance Issues

### Slow Analysis

**Issue**: Analysis is slow.

**Solution**:
1. Check Ollama resources
2. Verify file size
3. Check server resources
4. Optimize file content

### High Memory Usage

**Issue**: Application uses too much memory.

**Solution**:
1. Check file size
2. Monitor Ollama memory usage
3. Close unused applications
4. Restart application

### Browser Performance

**Issue**: Browser becomes slow or unresponsive.

**Solution**:
1. Clear browser cache
2. Close unused tabs
3. Update browser
4. Try different browser

## Getting Help

If you're still experiencing issues:

1. **Check Logs**
   - Browser console
   - Server logs
   - Ollama logs

2. **Search Issues**
   - Check [GitHub Issues](https://github.com/your-username/screenscore/issues)
   - Search for similar problems
   - Check closed issues

3. **Community Support**
   - Join [Discord Community](https://discord.gg/your-server)
   - Ask in relevant channels
   - Share error messages and logs

4. **Contact Support**
   - Open new issue
   - Include detailed information
   - Share relevant logs
   - Describe steps to reproduce

## Prevention Tips

1. **Regular Maintenance**
   - Keep Ollama updated
   - Update dependencies
   - Clear temporary files
   - Monitor system resources

2. **Best Practices**
   - Use supported file formats
   - Keep files under size limit
   - Regular backups
   - Monitor system resources

3. **System Requirements**
   - Sufficient RAM (8GB minimum)
   - Adequate storage
   - Stable internet connection
   - Updated operating system 