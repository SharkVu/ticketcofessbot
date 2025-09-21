const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Gửi một confession'),
  async initPrompt(client, config) {
    const confessPromptChannel = client.channels.cache.get(config.promptChannelId);
    if (confessPromptChannel) {
      try {
        const messages = await confessPromptChannel.messages.fetch({ limit: 100 });
        for (const message of messages.values()) {
          if (message.author.id === client.user.id && message.components.length > 0) {
            await message.delete();
            console.log('Đã xóa tin nhắn cũ chứa nút confession');
          }
        }
      } catch (error) {
        console.error('Lỗi khi xóa tin nhắn cũ trong kênh confession:', error);
      }

      const embed = new EmbedBuilder()
        .setColor('#FFD700') // Màu vàng
        .setTitle('💌 Gửi Confession')
        .setDescription(
          'Chọn 1 trong 2 nút dưới để gửi confession nha.\n' +
          'Bot sẽ gửi tin nhắn riêng thông báo cho bạn khi confession được duyệt.\n\n' +
          '**Mọi ý kiến đóng góp vui lòng gửi tin nhắn riêng cho ADMIN hoặc Mod**\n\n' +
          '📝 **Hướng dẫn gửi confession**\n' +
          'Chọn 1 trong 2 nút dưới để gửi confession.\n\n' +
          'Bot sẽ gửi tin nhắn riêng thông báo cho bạn khi confession được duyệt.\n' +
          '**🔒 Gửi ẩn danh**\n' +
          'Confession sẽ được gửi mà không hiển thị tên của bạn\n' +
          '**👤 Gửi hiện tên**\n' +
          'Confession sẽ hiển thị tên của bạn khi được duyệt\n\n' +
          '**Lưu ý**: Tất cả confession đều cần được duyệt trước khi hiển thị'
        );

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('anonymous')
            .setLabel('Gửi ẩn danh')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId('with_name')
            .setLabel('Gửi hiện tên')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👤')
        );

      try {
        await confessPromptChannel.send({ embeds: [embed], components: [row] });
        console.log('Đã gửi tin nhắn gợi ý confession đến kênh 1417143048843825193');
      } catch (error) {
        console.error('Lỗi khi gửi tin nhắn gợi ý confession:', error);
      }
    } else {
      console.error('Không tìm thấy kênh với ID 1417143048843825193');
    }
  },
  async execute(interaction, client, confessionCounter, incrementCounter, config) {
    // Xử lý lệnh /confess
    if (interaction.isCommand()) {
      const embed = new EmbedBuilder()
        .setColor('#FFD700') // Màu vàng
        .setTitle('💌 Gửi Confession')
        .setDescription(
          'Chọn 1 trong 2 nút dưới để gửi confession nha.\n' +
          'Bot sẽ gửi tin nhắn riêng thông báo cho bạn khi confession được duyệt.\n\n' +
          '**Mọi ý kiến đóng góp vui lòng gửi tin nhắn riêng cho ADMIN hoặc Mod**\n\n' +
          '📝 **Hướng dẫn gửi confession**\n' +
          'Chọn 1 trong 2 nút dưới để gửi confession.\n\n' +
          'Bot sẽ gửi tin nhắn riêng thông báo cho bạn khi confession được duyệt.\n' +
          '**🔒 Gửi ẩn danh**\n' +
          'Confession sẽ được gửi mà không hiển thị tên của bạn\n' +
          '**👤 Gửi hiện tên**\n' +
          'Confession sẽ hiển thị tên của bạn khi được duyệt\n\n' +
          '**Lưu ý**: Tất cả confession đều cần được duyệt trước khi hiển thị'
        );

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('anonymous')
            .setLabel('Gửi ẩn danh')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId('with_name')
            .setLabel('Gửi hiện tên')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👤')
        );

      await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }

    // Xử lý nút gửi confession
    if (interaction.isButton() && (interaction.customId === 'anonymous' || interaction.customId === 'with_name')) {
      const modal = new ModalBuilder()
        .setCustomId(`confess_modal_${interaction.customId}`)
        .setTitle('Nhập Confession');

      const contentInput = new TextInputBuilder()
        .setCustomId('confess_content')
        .setLabel('Nội dung confession (tối đa 3900 ký tự)')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(3900)
        .setRequired(true);

      const actionRow = new ActionRowBuilder().addComponents(contentInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    }

    // Xử lý modal gửi confession
    if (interaction.isModalSubmit() && interaction.customId.startsWith('confess_modal_')) {
      const content = interaction.fields.getTextInputValue('confess_content');
      const isAnonymous = interaction.customId === 'confess_modal_anonymous';
      const approvalChannel = client.channels.cache.get(config.approvalChannelId);

      if (!approvalChannel) {
        console.error(`Kênh phê duyệt (${config.approvalChannelId}) không tìm thấy hoặc không thể truy cập`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Không tìm thấy kênh phê duyệt!', flags: 64 });
        } else {
          await interaction.followUp({ content: 'Không tìm thấy kênh phê duyệt!', flags: 64 });
        }
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#808080') // Màu xám
        .setTitle(`Confession #${confessionCounter}`)
        .setDescription(
          `**Confession từ**: ${isAnonymous ? 'Ẩn danh' : 'Hiện tên'}\n` +
          `**Nội dung**: ${content}\n\n` +
          `**Người gửi**: <@${interaction.user.id}>`
        );

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${confessionCounter}_${interaction.user.id}_${isAnonymous}`)
            .setLabel('Phê duyệt')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_${confessionCounter}_${interaction.user.id}`)
            .setLabel('Từ chối')
            .setStyle(ButtonStyle.Danger)
        );

      await approvalChannel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: 'Confession của bạn đã được gửi để phê duyệt!', flags: 64 });
      incrementCounter(); // Tăng số thứ tự sau khi gửi confession
    }

    // Xử lý nút phê duyệt/từ chối
    if (interaction.isButton() && (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_'))) {
      await interaction.deferUpdate(); // Trì hoãn để tránh timeout

      const [action, confessId, userId, isAnonymous] = interaction.customId.split('_');
      const confessChannel = client.channels.cache.get(config.confessChannelId);
      const user = await client.users.fetch(userId).catch(() => null);

      if (!confessChannel) {
        console.error(`Kênh confession (${config.confessChannelId}) không tìm thấy`);
        await interaction.editReply({ content: 'Không tìm thấy kênh confession!', components: [], embeds: [] });
        return;
      }

      if (!user) {
        console.error(`Người dùng với ID ${userId} không tìm thấy`);
        await interaction.editReply({ content: 'Không tìm thấy người gửi confession!', components: [], embeds: [] });
        return;
      }

      const confessionContent = interaction.message.embeds[0].description.split('**Nội dung**: ')[1].split('\n\n')[0];

      if (action === 'approve') {
        const embed = new EmbedBuilder()
          .setColor('#FFD700') // Màu vàng
          .setTitle(isAnonymous === 'true' ? `Anonymous Confession #${confessId}` : `<@${userId}> Confession #${confessId}`)
          .setDescription(confessionContent); // Chỉ nội dung confession

        try {
          if (confessChannel.type === ChannelType.GuildForum) {
            // Tạo thread mới trong kênh diễn đàn
            const threadName = isAnonymous === 'true' 
              ? `Anonymous Confession #${confessId}` 
              : `<@${userId}> Confession #${confessId}`;
            const thread = await confessChannel.threads.create({
              name: threadName,
              message: { embeds: [embed] }
            });
            console.log(`Đã tạo thread cho confession #${confessId} trong kênh diễn đàn`);
          } else {
            // Dự phòng cho kênh text
            await confessChannel.send({ embeds: [embed] });
          }

          // Gửi DM thông báo phê duyệt
          const approveEmbed = new EmbedBuilder()
            .setColor('#00FF00') // Màu xanh lá
            .setTitle(`Confession của bạn đã được phê duyệt!`)
            .setDescription(
              `Confession của bạn đã được phê duyệt trong kênh diễn đàn!\n` +
              `**${isAnonymous === 'true' ? 'Anonymous Confession' : `<@${userId}> Confession`} #${confessId}**\n` +
              `"${confessionContent}"`
            );
          await user.send({ embeds: [approveEmbed] });

          await interaction.editReply({ content: 'Đã phê duyệt confession!', components: [], embeds: [] });
        } catch (error) {
          console.error(`Lỗi khi đăng confession lên kênh (${config.confessChannelId}):`, error);
          await interaction.editReply({ content: 'Lỗi khi đăng confession lên kênh!', components: [], embeds: [] });
        }
      } else {
        // Gửi DM thông báo từ chối
        const rejectEmbed = new EmbedBuilder()
          .setColor('#FF0000') // Màu đỏ
          .setTitle('Confession của bạn đã bị từ chối')
          .setDescription(
            `Confession của bạn không được phê duyệt.\n` +
            `"${confessionContent}"\n\n` +
            'Vui lòng liên hệ ADMIN nếu cần thêm thông tin.'
          );
        await user.send({ embeds: [rejectEmbed] });

        await interaction.editReply({ content: 'Đã từ chối confession!', components: [], embeds: [] });
      }
    }
  }
};